/**
 * The atlas font registry, keyed by (family, weight, style), and the fallback
 * chain that resolves a request against it.
 */

import { textureCacheKey } from './textureCacheKey';
import { variantKey } from './variantKey';
import { createReflectable, type Reflection } from '@weasel-js/registry';
import type { FontStyle } from './fontStyle';
import { notifyGlyphReady } from './glyphReady';
import { parseBmFont, type BmFont } from './FontAtlas';
import type { GlyphTextureSink } from './textureSink';
import {
  isCanvasFont, isExplicitCanvasFont, autoEnrollCanvasFont, getDynamicFace,
  type DynamicFace,
} from './dynamic/dynamicAtlas';
import {
  getFontFallbackPolicy, getDefaultFontFamily,
  claimFallbackWarning, _clearFallbackWarnings,
} from './fallback';
import {
  hasFontOutlines, listFontOutlines, loadFontOutlines, outlineMetrics, outlineStatus,
} from './outline/outlineRegistry';
import type { OutlineFace } from './outline/OutlineFace';
import type { FaceMetrics } from './faceMetrics';

/** A registered face: its parsed metrics and the atlas image to sample. */
export interface FontEntry {
  font: BmFont;
  bitmap: ImageBitmap;
}

/** Which face within a family. Defaults to weight 400, style `'normal'`. */
export interface FontVariant {
  weight?: number;
  style?: FontStyle;
}


/** One family's registered faces, keyed `${weight}|${style}`. */
export type FontFamilyFaces = ReadonlyMap<string, FontEntry>;

const registry = createReflectable<FontFamilyFaces>();

/** Every registered family and its faces, in registration order. `listFonts`
 *  is the same set shaped for a font picker. */
export const fontRegistry: Reflection<FontFamilyFaces> = registry.reflection;

function normalizeVariant(v: FontVariant): { weight: number; style: FontStyle } {
  return {
    weight: v.weight ?? 400,
    style: v.style ?? 'normal',
  };
}

/** Atlas registrations still fetching, per family. One token per call, so a
 *  reset that clears the map cannot be undone by a late `finally`. */
const inFlight = new Map<string, Set<object>>();

/** One variant's fetch, keyed `family|weight|style`, so a lazy declaration and
 *  an eager call for the same face share it. */
const loads = new Map<string, Promise<void>>();

/** A lazily registered variant nothing has asked for yet. */
interface Declared {
  metricsUrl: string;
  atlasUrl: string;
  promise: Promise<void>;
  settle: (load: Promise<void>) => void;
}

/** Lazy registrations not yet started, per family, keyed like `registry`. */
const declared = new Map<string, Map<string, Declared>>();

/** Every family `registerFont` was called for, eager or lazy, in call order —
 *  what "the first registered family" means to the substitute policy. */
const registeredFamilies = new Set<string>();

/** Test helper. Do not call from product code. */
export function _resetFontRegistryForTests(): void {
  registry.clear();
  inFlight.clear();
  loads.clear();
  declared.clear();
  registeredFamilies.clear();
  _clearFallbackWarnings();
}

/** Exact lookup — does NOT walk the fallback chain. Use `resolveFontVariant` for that. */
export function getFont(
  family: string,
  weight: number = 400,
  style: FontStyle = 'normal',
): FontEntry | null {
  return registry.get(family)?.get(variantKey(weight, style)) ?? null;
}

/**
 * The decoration and script metrics of an exact `(family, weight, style)` —
 * the atlas's when one is registered, else a loaded outline face's. Like
 * {@link getFont}, it walks no fallback chain and enrolls no canvas font.
 * An idle outline face starts loading, as it would for layout.
 * A run already resolved for layout reads `faceMetricsOf(result)` instead.
 */
export function faceMetricsFor(
  family: string,
  weight: number = 400,
  style: FontStyle = 'normal',
): FaceMetrics | undefined {
  return getFont(family, weight, style)?.font.faceMetrics
    ?? outlineMetrics(family, weight, style === 'italic' ? 'italic' : 'normal')?.faceMetrics;
}

/** One family in the registry and the variants registered for it — what a
 *  font picker can honestly offer. */
export interface RegisteredFont {
  family: string;
  variants: readonly { weight: number; style: FontStyle }[];
}

/**
 * Enumerate the registry. Families come back in registration order; variants
 * sorted by weight, then style.
 */
export function listFonts(): readonly RegisteredFont[] {
  const out: RegisteredFont[] = [];
  for (const family of registeredFamilies) {
    const keys = new Set([
      ...(registry.get(family)?.keys() ?? []),
      ...(declared.get(family)?.keys() ?? []),
    ]);
    if (keys.size === 0) continue;
    const variants = [...keys]
      .map((key) => {
        const [w, s] = key.split('|') as [string, FontStyle];
        return { weight: Number(w), style: s };
      })
      .sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));
    out.push({ family, variants });
  }
  return out;
}

/**
 * The weights `family` has a real face for, on the atlas tier or the outline
 * tier, in either style. Ascending and deduplicated; empty for a family
 * nothing registered. An outline face whose load failed is left out. The
 * canvas tier is not consulted: it rasterizes whatever weight it is asked for.
 */
export function listFontWeights(family: string): readonly number[] {
  const weights = new Set<number>();
  for (const key of registry.get(family)?.keys() ?? []) weights.add(Number(key.split('|')[0]));
  for (const key of declared.get(family)?.keys() ?? []) weights.add(Number(key.split('|')[0]));
  for (const face of listFontOutlines()) {
    if (face.family === family && face.status !== 'failed') weights.add(face.weight);
  }
  return [...weights].sort((a, b) => a - b);
}

/** Options for {@link registerFont}. */
export interface RegisterFontOptions {
  /**
   * Fetch nothing until text first resolves this face. Layout treats the face
   * as pending from registration on, so a run set in it lays out as nothing —
   * never in a fallback face's metrics — and relays out when the atlas lands.
   * The returned promise settles with that load, so it never settles for a
   * face no text uses.
   */
  lazy?: boolean;
}

/**
 * Register a baked MSDF atlas and its metrics as one variant of `family`.
 * Resolves once the face is usable; re-registering a variant that is already
 * present is a no-op.
 *
 * Eager by default: both files are fetched now. With `{ lazy: true }` they are
 * fetched the first time text asks for the family.
 */
export function registerFont(
  family: string,
  variant: FontVariant,
  metricsUrl: string,
  atlasUrl: string,
  opts: RegisterFontOptions = {},
): Promise<void> {
  const { weight, style } = normalizeVariant(variant);
  const key = variantKey(weight, style);
  registeredFamilies.add(family);

  if (registry.get(family)?.has(key)) return Promise.resolve();
  if (!opts.lazy) return loadVariant(family, key, metricsUrl, atlasUrl);

  const running = loads.get(`${family}|${key}`);
  if (running) return running;
  const existing = declared.get(family)?.get(key);
  if (existing) return existing.promise;

  let settle!: (load: Promise<void>) => void;
  const promise = new Promise<void>((resolve, reject) => {
    settle = (load) => { load.then(resolve, reject); };
  });
  const variants = declared.get(family) ?? new Map<string, Declared>();
  declared.set(family, variants.set(key, { metricsUrl, atlasUrl, promise, settle }));
  // A layout that already missed on this family caches that miss until the
  // generation moves; this is what makes it ask again, and so start the load.
  notifyGlyphReady();
  return promise;
}

/** Start (or join) the fetch for one variant, consuming any lazy declaration. */
function loadVariant(
  family: string, key: string, metricsUrl: string, atlasUrl: string,
): Promise<void> {
  const id = `${family}|${key}`;
  const running = loads.get(id);
  if (running) return running;

  const load = fetchVariant(family, key, metricsUrl, atlasUrl);
  loads.set(id, load);
  const settleLoad = () => { if (loads.get(id) === load) loads.delete(id); };
  load.then(settleLoad, settleLoad);

  const pendingLazy = declared.get(family)?.get(key);
  if (pendingLazy) {
    const variants = declared.get(family)!;
    variants.delete(key);
    if (variants.size === 0) declared.delete(family);
    pendingLazy.settle(load);
  }
  return load;
}

async function fetchVariant(
  family: string, key: string, metricsUrl: string, atlasUrl: string,
): Promise<void> {
  const [weight, style] = key.split('|') as [string, FontStyle];
  const token = {};
  const tokens = inFlight.get(family) ?? new Set<object>();
  inFlight.set(family, tokens.add(token));
  try {
    const [metricsRes, atlasRes] = await Promise.all([
      fetch(metricsUrl),
      fetch(atlasUrl),
    ]);

    if (!metricsRes.ok) {
      throw new Error(`HTTP ${metricsRes.status} fetching metrics from ${metricsUrl}`);
    }
    if (!atlasRes.ok) {
      throw new Error(`HTTP ${atlasRes.status} fetching atlas from ${atlasUrl}`);
    }

    const [rawJson, blob] = await Promise.all([
      metricsRes.json(),
      atlasRes.blob(),
    ]);

    const font = parseBmFont(rawJson);
    const bitmap = await createImageBitmap(blob);

    // Copy the family as it is now, not as it was before the await: another
    // variant of it may have landed meanwhile, and a stale copy would drop it.
    registry.set(family, new Map(registry.get(family)).set(key, { font, bitmap }));
    settle(family, token);
    // Same meaning the lazy tiers give it: text that was painting from a
    // fallback face — or painting nothing — can now paint from this one.
    notifyGlyphReady();
  } catch (err) {
    settle(family, token);
    // Layout held back its no-metrics warning while this was in flight; the
    // relayout this triggers is where that warning finally gets to fire.
    notifyGlyphReady();
    throw new Error(
      `weasel registerFont("${family}" ${weight}/${style}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Start the lazy loads a request for `(family, weight, style)` needs: the
 * exact variant when it was declared, otherwise every declared variant of the
 * family, since the within-family chain may land on any of them.
 */
function wakeDeclared(family: string, weight: number, style: FontStyle): void {
  const variants = declared.get(family);
  if (!variants) return;
  const exact = variantKey(weight, style);
  const keys = variants.has(exact) ? [exact] : [...variants.keys()];
  for (const key of keys) {
    const { metricsUrl, atlasUrl } = variants.get(key)!;
    // The declaration's own promise carries the failure to its caller.
    loadVariant(family, key, metricsUrl, atlasUrl).catch(() => {});
  }
}

/** One face text is set in, the way a render asks for it — what
 *  {@link warmFonts} takes to load that face and nothing else. Weight
 *  defaults to 400 and style to `'normal'`. */
export interface FontRequest {
  family: string;
  weight?: number;
  style?: FontStyle;
}

/**
 * Load registered atlases ahead of their first use, so a synchronous render —
 * `renderSceneToPixels`, an export, a print — draws text set in a lazily
 * registered face rather than nothing. With no list, loads every family
 * `registerFont` was called for.
 *
 * A family name loads every variant registered for it. A {@link FontRequest}
 * loads what resolving that one variant would draw with: the exact variant
 * when one was registered, otherwise every variant of the family, since the
 * within-family chain may land on any; the family the `'substitute'` policy
 * would draw instead when the requested one has no atlas; and the variant's
 * outline face when one is registered.
 *
 * Resolves once they have all landed; a registered variant counts as loaded.
 * Rejects when a load fails, or for a family name `registerFont` never saw —
 * a {@link FontRequest} for such a family is not an error, since the canvas
 * and outline tiers serve families no atlas was registered for.
 */
export function warmFonts(fonts?: readonly (string | FontRequest)[]): Promise<void> {
  const pending: Promise<unknown>[] = [];
  for (const font of fonts ?? [...registeredFamilies]) {
    if (typeof font !== 'string') {
      const { weight, style } = normalizeVariant(font);
      pending.push(...variantLoads(font.family, weight, style));
      continue;
    }
    if (!registeredFamilies.has(font)) {
      return Promise.reject(new Error(`weasel warmFonts: "${font}" was never registered.`));
    }
    for (const [key, { metricsUrl, atlasUrl }] of [...(declared.get(font) ?? [])]) {
      loadVariant(font, key, metricsUrl, atlasUrl);
    }
    pending.push(...familyLoads(font));
  }
  return Promise.all(pending).then(() => undefined);
}

/** Every atlas fetch running for `family`. */
function familyLoads(family: string): Promise<void>[] {
  return [...loads].filter(([id]) => id.startsWith(`${family}|`)).map(([, load]) => load);
}

/** The loads `(family, weight, style)` resolves through, started — the same
 *  tiers, in the same order, as `resolveFontVariantInternal`. */
function variantLoads(family: string, weight: number, style: FontStyle): Promise<unknown>[] {
  const out: Promise<unknown>[] = [];
  const outlines = hasFontOutlines(family, weight, style);
  if (outlines) out.push(loadFontOutlines(family, { weight, style }));
  const key = variantKey(weight, style);
  if (registry.get(family)?.has(key)) return out;
  wakeDeclared(family, weight, style);
  const exact = loads.get(`${family}|${key}`);
  if (exact) return [...out, exact];
  if (registry.has(family) || atlasPending(family)) return [...out, ...familyLoads(family)];
  if (outlines || isExplicitCanvasFont(family) || getFontFallbackPolicy() !== 'substitute') return out;
  const fallback = getDefaultFontFamily() ?? firstRegisteredFamily();
  return fallback !== null && fallback !== family ? [...out, ...variantLoads(fallback, weight, style)] : out;
}

/** Is an atlas for this family on its way — declared lazily or fetching? */
function atlasPending(family: string): boolean {
  return inFlight.has(family) || declared.has(family);
}

function settle(family: string, token: object): void {
  const tokens = inFlight.get(family);
  if (!tokens?.delete(token)) return;
  if (tokens.size === 0) inFlight.delete(family);
}

/**
 * Could a registration that has not landed yet still serve this request?
 * True while any `registerFont` for the family is fetching — the within-family
 * chain may resolve to whichever variant it brings — or while an outline face
 * registered for this exact variant has not finished loading. Tells a face
 * that is missing from one that is merely late.
 */
export function fontPending(family: string, weight = 400, style: FontStyle = 'normal'): boolean {
  if (atlasPending(family)) return true;
  const outline = outlineStatus(family, weight, style === 'italic' ? 'italic' : 'normal');
  return outline === 'idle' || outline === 'loading';
}

/**
 * Ensure the atlas for `(family, weight, style)` is uploaded to
 * `textureCache`. Cache key is `${family}|${weight}|${style}` so each
 * variant occupies its own texture slot.
 */
export function ensureFontTexture(
  family: string,
  weight: number,
  style: FontStyle,
  textureCache: GlyphTextureSink,
): boolean {
  const entry = getFont(family, weight, style);
  if (!entry) return false;
  textureCache.upload(textureCacheKey(family, weight, style), entry.bitmap);
  return true;
}

export { textureCacheKey } from './textureCacheKey';

/** Kept as a no-op for context-restore call sites; per-cache dedup handles it now. */
export function markAllFontsNotUploaded(): void {}

/** What `resolveFontVariant` found: the atlas to draw with, the face it
 *  actually landed on after walking the fallback chain, and what has to be
 *  synthesized to cover the difference. */
export interface ResolveResult {
  entry: FontEntry | null;
  /**
   * The (family, weight, style) triple that was actually matched. May differ
   * from the requested values when the resolver walked the fallback chain —
   * including `family`, when the cross-family policy substituted a default.
   *
   * This is the atlas identity: pass all three to `getFont` /
   * `textureCacheKey` and the lookup hits. Keying a draw on the *requested*
   * family resolves to no atlas at all and paints nothing.
   *
   * The synthetic flags describe the gap between requested and resolved for
   * shader-side compensation. When `entry` is null, these mirror the
   * requested values.
   */
  resolved: { family: string; weight: number; style: FontStyle };
  synthetic: { bold: boolean; italic: boolean };
  /** Which tier resolved: a baked MSDF atlas, the runtime canvas-SDF dynamic
   *  atlas, or a parsed font face serving both geometry and metrics. Misses
   *  report 'atlas' (the default tier). */
  source: 'atlas' | 'canvas' | 'outline';
  /** Set only when source === 'canvas': the dynamic face whose BmFont-shaped
   *  `font` layoutRuns consumes in place of `entry.font`. */
  dynamicFace?: DynamicFace;
  /** Set only when source === 'outline': the parsed face supplying advances,
   *  kerning and the baseline. There is no atlas behind this tier, so it is
   *  the only metrics source the run has. */
  outlineFace?: OutlineFace;
  /**
   * Set when the requested family was not registered and the fallback policy
   * substituted a different one, so a UI can say "Inter — not loaded, showing
   * Roboto".
   */
  substituted?: { requested: string; resolved: string };
}

function missResolveResult(
  family: string, weight: number, style: FontStyle, suppressWarn = false,
): ResolveResult {
  // Canvas-dynamic tier. Dynamic faces rasterize the real weight/style — no
  // synthetic flags.
  //
  // Explicit enrollment only. A family the `'canvas'` policy enrolled for
  // itself must not keep routing here after the policy changes, or `'none'`
  // could never restore the hard miss it documents.
  if (isExplicitCanvasFont(family)) {
    return {
      entry: null,
      dynamicFace: getDynamicFace(family, weight, style),
      resolved: { family, weight, style },
      synthetic: { bold: false, italic: false },
      source: 'canvas',
    };
  }

  // Outline-only: a family with parsed font bytes and no atlas. Ranked above
  // every fallback below because it is the *real* face, and below explicit
  // canvas enrollment, which is a consumer saying which tier it wants.
  const face = outlineMetrics(family, weight, style === 'italic' ? 'italic' : 'normal');
  if (face) {
    return {
      entry: null,
      outlineFace: face,
      resolved: { family, weight, style },
      synthetic: { bold: false, italic: false },
      source: 'outline',
    };
  }
  // Its bytes are on their way, which outranks a stand-in as a pending atlas does.
  if (fontPending(family, weight, style)) return pendingMiss(family, weight, style);

  const policy = getFontFallbackPolicy();

  if (policy === 'canvas') {
    // Auto-enroll: the browser probably has this family even though no atlas
    // was baked for it. Real typeface, canvas-SDF quality.
    autoEnrollCanvasFont(family);
    return {
      entry: null,
      dynamicFace: getDynamicFace(family, weight, style),
      resolved: { family, weight, style },
      synthetic: { bold: false, italic: false },
      source: 'canvas',
    };
  }

  if (policy === 'substitute') {
    const fallback = getDefaultFontFamily() ?? firstRegisteredFamily();
    // Guard against recursing when the default family is itself unknown.
    // Canvas families never enter `registry`, so membership there alone would
    // reject `setDefaultFontFamily` pointed at one. `isCanvasFont` answers
    // "served by the dynamic tier right now": a family the `'canvas'` policy
    // auto-enrolled is not served under this policy.
    if (fallback !== null && fallback !== family) {
      if (registry.has(fallback) || isCanvasFont(fallback) || atlasPending(fallback)) {
        // A probe, not a top-level request: suppress, so this recursion can't
        // land in the `fallback === family` branch below and double-warn.
        const result = resolveFontVariantInternal(fallback, weight, style, true);
        // Renderable, not baked: a fallback served by the dynamic tier reports
        // `entry: null` with a dynamicFace.
        if (result.entry !== null || result.dynamicFace !== undefined) {
          if (!suppressWarn) warnMissingFamilyOnce(family, weight, style, fallback);
          return { ...result, substituted: { requested: family, resolved: fallback } };
        }
        // Still loading: nothing to swap to yet, and nothing to warn about.
        if (atlasPending(fallback)) return pendingMiss(family, weight, style);
      }
      // Substitution was supposed to happen and produced nothing: text is
      // invisible, so say which of the two families to fix.
      if (!suppressWarn) warnUnusableDefaultOnce(family, weight, style, fallback);
    } else if (fallback === family && !suppressWarn) {
      // The family that can't serve this variant *is* the effective default.
      // Nothing renders and, without this branch, nothing is logged either.
      if (registry.has(family)) {
        warnSelfUnusableDefaultOnce(family, weight, style);
      } else {
        // Unregistered, yet still the effective default: it can only have been
        // named explicitly, because the implicit one is the first *registered*
        // family.
        warnUnregisteredDefaultOnce(family, weight, style);
      }
    }
  }

  return {
    entry: null,
    resolved: { family, weight, style },
    synthetic: { bold: false, italic: false },
    source: 'atlas',
  };
}

/** The first family an app registered that has, or will have, an atlas. */
function firstRegisteredFamily(): string | null {
  for (const family of registeredFamilies) {
    if (registry.has(family) || atlasPending(family)) return family;
  }
  return null;
}

/** A miss that is only late: nothing substituted, nothing warned. */
function pendingMiss(family: string, weight: number, style: FontStyle): ResolveResult {
  return {
    entry: null,
    resolved: { family, weight, style },
    synthetic: { bold: false, italic: false },
    source: 'atlas',
  };
}

// Resolution runs per frame, so an unguarded warn would flood the console.
// The claimed keys live in fallback.ts so both reset seams clear them.
function warnMissingFamilyOnce(
  family: string, weight: number, style: FontStyle, resolved: string,
): void {
  if (!claimFallbackWarning(`substituted|${family}|${weight}|${style}`)) return;
  const cause = registry.has(family)
    ? `has no variant matching ${weight}/${style}, and none of its registered ` +
      `variants are close enough for the within-family chain to substitute — ` +
      `rendering with "${resolved}" instead. Bake that variant with ` +
      `registerFont("${family}", { weight: ${weight}, style: '${style}' }, …)`
    : `is not registered — rendering with "${resolved}" instead. ` +
      `Call registerFont("${family}", …)`;
  console.warn(
    `weasel: font family "${family}" (${weight}/${style}) ${cause}. ` +
    `Advance widths will differ from the requested font. Use ` +
    `setFontFallbackPolicy('none') to make this a hard miss instead.`,
  );
}

/**
 * The substitute policy engaged and still came up empty: nothing renders, and
 * the fix is almost always in the fallback family rather than the requested one.
 */
function warnUnusableDefaultOnce(
  family: string, weight: number, style: FontStyle, fallback: string,
): void {
  if (!claimFallbackWarning(`unusable-default|${family}|${weight}|${style}`)) return;
  const origin = getDefaultFontFamily() === fallback
    ? 'set via setDefaultFontFamily'
    : 'the first registered family, since setDefaultFontFamily was never called';
  // A fallback the `'canvas'` policy auto-enrolled has nothing serving it
  // under this policy, so it counts as not registered.
  const gap = registry.has(fallback) || isCanvasFont(fallback)
    ? `has no variant that can serve ${weight}/${style}`
    : 'is not registered either';
  console.warn(
    `weasel: font family "${family}" (${weight}/${style}) is not available, and ` +
    `the fallback family "${fallback}" (${origin}) ${gap} — this text will not ` +
    `render at all. Bake that variant with registerFont("${fallback}", ` +
    `{ weight: ${weight}, style: '${style}' }, …), or point ` +
    `setDefaultFontFamily() at a family that covers it.`,
  );
}

/**
 * The requested family is registered and is also the effective default, so
 * there is nowhere left to fall back to.
 */
function warnSelfUnusableDefaultOnce(
  family: string, weight: number, style: FontStyle,
): void {
  if (!claimFallbackWarning(`self-unusable-default|${family}|${weight}|${style}`)) return;
  const origin = getDefaultFontFamily() === family
    ? 'set via setDefaultFontFamily'
    : 'the first registered family, since setDefaultFontFamily was never called';
  console.warn(
    `weasel: font family "${family}" (${weight}/${style}) has no variant that can ` +
    `serve this request, and "${family}" is also the fallback family (${origin}) — ` +
    `there is nothing left to fall back to, so this text will not render at all. ` +
    `Bake that variant with registerFont("${family}", { weight: ${weight}, ` +
    `style: '${style}' }, …), or point setDefaultFontFamily() at a different family.`,
  );
}

/**
 * The requested family is the explicitly set default, and that default names
 * a family that was never registered at all.
 */
function warnUnregisteredDefaultOnce(
  family: string, weight: number, style: FontStyle,
): void {
  if (!claimFallbackWarning(`unregistered-default|${family}|${weight}|${style}`)) return;
  console.warn(
    `weasel: font family "${family}" (${weight}/${style}) was never registered, and ` +
    `it is also the fallback family — setDefaultFontFamily("${family}") names a ` +
    `family with no registered variants at all, so there is nothing left to fall ` +
    `back to and this text will not render at all. Call registerFont("${family}", ` +
    `{ weight: ${weight}, style: '${style}' }, …), or point setDefaultFontFamily() ` +
    `at a family you have registered.`,
  );
}

function weightBucket(w: number): 'regular' | 'bold' {
  return w >= 600 ? 'bold' : 'regular';
}

/**
 * Resolve a `(family, weight, style)` request to a registered font entry,
 * walking the fallback chain when an exact match isn't available. Returns
 * synthetic flags describing the gap between requested and resolved so the
 * renderer can apply SDF-thicken / vertex-skew fakes.
 */
export function resolveFontVariant(
  family: string,
  weight: number,
  style: FontStyle,
): ResolveResult {
  return resolveFontVariantInternal(family, weight, style, false);
}

/**
 * Escalate a *single codepoint* to the dynamic tier when the atlas that
 * resolved for the run has no glyph for it.
 *
 * A baked MSDF atlas covers a fixed charset, so a run it serves can still
 * contain a character it never baked — an em dash, a curly quote. The dynamic
 * tier rasterizes on demand from installed fonts and can serve those.
 *
 * Returns a canvas-tier `ResolveResult` whose `dynamicFace` the caller drives
 * with `requestGlyph(cp)`, or `null` when escalation isn't available: under
 * policy `'none'`, which documents a miss as a *hard* miss, or with no canvas
 * to rasterize into (SSR, a jsdom test without one).
 */
export function resolveGlyphFallback(
  family: string,
  weight: number,
  style: FontStyle,
): ResolveResult | null {
  if (getFontFallbackPolicy() === 'none') return null;
  try {
    return {
      entry: null,
      dynamicFace: getDynamicFace(family, weight, style),
      resolved: { family, weight, style },
      // The dynamic tier rasterizes the real weight and style, so there is
      // nothing for the shader to fake.
      synthetic: { bold: false, italic: false },
      source: 'canvas',
    };
  } catch {
    return null;
  }
}

/**
 * `suppressWarn` is set only by the recursive substitution probe in
 * `missResolveResult`, which resolves the fallback family purely to check
 * whether it renders. The probe must not emit — or claim the warn-once key
 * for — a message about a resolution the caller never made.
 */
function resolveFontVariantInternal(
  family: string,
  weight: number,
  style: FontStyle,
  suppressWarn: boolean,
): ResolveResult {
  wakeDeclared(family, weight, style);
  // An atlas on its way outranks every stand-in: laying out in a fallback's
  // metrics now would reflow the text when the real face lands.
  // A landed variant is not on its way, even before its load promise settles:
  // `fetchVariant` wakes subscribers first, and they resolve synchronously.
  const exactKey = variantKey(weight, style);
  if (loads.size > 0 && loads.has(`${family}|${exactKey}`) && !registry.get(family)?.has(exactKey)) {
    return pendingMiss(family, weight, style);
  }
  const familyMap = registry.get(family);
  if (!familyMap || familyMap.size === 0) {
    if (atlasPending(family)) return pendingMiss(family, weight, style);
    return missResolveResult(family, weight, style, suppressWarn);
  }

  // 1. Exact match
  const exact = familyMap.get(exactKey);
  if (exact) {
    return {
      entry: exact,
      resolved: { family, weight, style },
      synthetic: { bold: false, italic: false },
      source: 'atlas',
    };
  }

  // 2. Same style, nearest weight in same bucket (ties broken by higher weight)
  const requestedBucket = weightBucket(weight);
  let bestSameStyle: { entry: FontEntry; weight: number; distance: number } | null = null;
  for (const [key, entry] of familyMap) {
    const [wStr, s] = key.split('|') as [string, FontStyle];
    const w = Number(wStr);
    if (s !== style) continue;
    if (weightBucket(w) !== requestedBucket) continue;
    const distance = Math.abs(w - weight);
    if (
      bestSameStyle === null ||
      distance < bestSameStyle.distance ||
      (distance === bestSameStyle.distance && w > bestSameStyle.weight)
    ) {
      bestSameStyle = { entry, weight: w, distance };
    }
  }
  if (bestSameStyle) {
    return {
      entry: bestSameStyle.entry,
      resolved: { family, weight: bestSameStyle.weight, style },
      synthetic: { bold: false, italic: false },
      source: 'atlas',
    };
  }

  // 3. (family, 400, style)
  const sameStyleRegular = familyMap.get(variantKey(400, style));
  if (sameStyleRegular) {
    return {
      entry: sameStyleRegular,
      resolved: { family, weight: 400, style },
      synthetic: {
        bold: weight >= 600,
        italic: false,
      },
      source: 'atlas',
    };
  }

  // 4. (family, weight, 'normal') — same weight, no italic
  const sameWeightNormal = familyMap.get(variantKey(weight, 'normal'));
  if (sameWeightNormal) {
    return {
      entry: sameWeightNormal,
      resolved: { family, weight, style: 'normal' },
      synthetic: {
        bold: false,
        italic: style === 'italic',
      },
      source: 'atlas',
    };
  }

  // 4b. Nearest weight, normal style, same bucket
  let bestNormal: { entry: FontEntry; weight: number; distance: number } | null = null;
  for (const [key, entry] of familyMap) {
    const [wStr, s] = key.split('|') as [string, FontStyle];
    const w = Number(wStr);
    if (s !== 'normal') continue;
    if (weightBucket(w) !== requestedBucket) continue;
    const distance = Math.abs(w - weight);
    if (
      bestNormal === null ||
      distance < bestNormal.distance ||
      (distance === bestNormal.distance && w > bestNormal.weight)
    ) {
      bestNormal = { entry, weight: w, distance };
    }
  }
  if (bestNormal) {
    return {
      entry: bestNormal.entry,
      resolved: { family, weight: bestNormal.weight, style: 'normal' },
      synthetic: {
        bold: false,
        italic: style === 'italic',
      },
      source: 'atlas',
    };
  }

  // 5. (family, 400, 'normal') — last resort within family
  const regular = familyMap.get(variantKey(400, 'normal'));
  if (regular) {
    return {
      entry: regular,
      resolved: { family, weight: 400, style: 'normal' },
      synthetic: {
        bold: weight >= 600,
        italic: style === 'italic',
      },
      source: 'atlas',
    };
  }

  return missResolveResult(family, weight, style, suppressWarn);
}
