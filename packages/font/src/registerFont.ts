/**
 * The atlas font registry, keyed by (family, weight, style): registering a
 * face, fetching it eagerly or on first use, and looking it up.
 */

import { textureCacheKey } from './textureCacheKey';
import { variantKey } from './variantKey';
import { _clearHeldFontUrls, claimFontUrls, landFontUrls, releaseFontUrls } from './heldFontUrls';
import { createReflectable, type Reflection } from '@weasel-js/registry';
import { normalizeVariant, type FontStyle, type FontVariant } from './fontStyle';
import { notifyGlyphReady } from './glyphReady';
import { parseBmFont, type BmFont } from './FontAtlas';
import type { GlyphTextureSink } from './textureSink';
import { isExplicitCanvasFont } from './dynamic/dynamicAtlas';
import { getFontFallbackPolicy, getDefaultFontFamily, _clearFallbackWarnings } from './fallback';
import {
  hasFontOutlines, listFontOutlines, loadFontOutlines, outlineFace, outlineStatus,
} from './outline/outlineRegistry';
import type { FaceMetrics } from './faceMetrics';

/** A registered face: its parsed metrics and the atlas image to sample. */
export interface FontEntry {
  font: BmFont;
  bitmap: ImageBitmap;
}



/** One family's registered faces, keyed `${weight}|${style}`. */
export type FontFamilyFaces = ReadonlyMap<string, FontEntry>;

const registry = createReflectable<FontFamilyFaces>({ name: 'fonts' });

/** Every registered family and its faces, in registration order. `listAtlasFonts`
 *  is the same set shaped for a font picker. */
export const fontRegistry: Reflection<FontFamilyFaces> = registry.reflection;

/** Atlas registrations still fetching, per family. One token per call, so a
 *  reset that clears the map cannot be undone by a late `finally`. */
const inFlight = new Map<string, Set<object>>();

/** One variant's fetch, per family and keyed like `registry`, so a lazy
 *  declaration and an eager call for the same face share it. Per family, since a
 *  family's name may hold the `|` the variant keys are joined with. */
const loads = new Map<string, Map<string, Promise<void>>>();

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
  _clearHeldFontUrls();
}

/** Exact lookup — does NOT walk the fallback chain. Use `resolveFontVariant` for that. */
export function getAtlasFont(
  family: string,
  weight: number = 400,
  style: FontStyle = 'normal',
): FontEntry | null {
  return registry.get(family)?.get(variantKey(weight, style)) ?? null;
}

/**
 * The decoration and script metrics of an exact `(family, weight, style)` —
 * the atlas's when one is registered, else a loaded outline face's. Like
 * {@link getAtlasFont}, it walks no fallback chain and enrolls no canvas font.
 * An idle outline face starts loading, as it would for layout.
 * A run already resolved for layout reads `faceMetricsOf(result)` instead.
 */
export function faceMetricsFor(
  family: string,
  weight: number = 400,
  style: FontStyle = 'normal',
): FaceMetrics | undefined {
  return getAtlasFont(family, weight, style)?.font.faceMetrics
    ?? outlineFace(family, weight, style)?.faceMetrics;
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
export function listAtlasFonts(): readonly RegisteredFont[] {
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
  /** Take the place of other URLs this variant was registered with, which otherwise throws. */
  replace?: boolean;
}

/**
 * Register a baked MSDF atlas and its metrics as one variant of `family`.
 * Resolves once the face is usable. Re-registering a variant with the URLs it
 * holds is a no-op; other URLs throw unless `replace` is set, which fetches them.
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
  const replacing = claimFontUrls(family, key, metricsUrl, atlasUrl, opts.replace);
  if (replacing) return replaceVariant(family, key, metricsUrl, atlasUrl);
  if (registry.get(family)?.has(key)) return Promise.resolve();
  if (!opts.lazy) return loadVariant(family, key, metricsUrl, atlasUrl);

  const running = loads.get(family)?.get(key);
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

/** Point a variant at new URLs: a lazy declaration takes them, anything else fetches them now. */
function replaceVariant(family: string, key: string, metricsUrl: string, atlasUrl: string): Promise<void> {
  const lazy = declared.get(family)?.get(key);
  if (lazy) return Object.assign(lazy, { metricsUrl, atlasUrl }).promise;
  loads.get(family)?.delete(key);
  return loadVariant(family, key, metricsUrl, atlasUrl);
}

/** Start (or join) the fetch for one variant, consuming any lazy declaration. */
function loadVariant(
  family: string, key: string, metricsUrl: string, atlasUrl: string,
): Promise<void> {
  const running = loads.get(family)?.get(key);
  if (running) return running;

  const load = fetchVariant(family, key, metricsUrl, atlasUrl);
  loads.set(family, (loads.get(family) ?? new Map<string, Promise<void>>()).set(key, load));
  const settleLoad = () => {
    const now = loads.get(family);
    if (now?.get(key) === load && now.delete(key) && now.size === 0) loads.delete(family);
  };
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
    if (landFontUrls(family, key, metricsUrl, atlasUrl)) {
      registry.set(family, new Map(registry.get(family)).set(key, { font, bitmap }));
    }
    settle(family, token);
    // Same meaning the lazy tiers give it: text that was painting from a
    // fallback face — or painting nothing — can now paint from this one.
    notifyGlyphReady();
  } catch (err) {
    settle(family, token);
    releaseFontUrls(family, key, metricsUrl, atlasUrl);
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
export function wakeDeclared(family: string, weight: number, style: FontStyle): void {
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
  return [...(loads.get(family)?.values() ?? [])];
}

/** The atlas fetch running for one variant, keyed like the registry, if any. */
export function variantLoad(family: string, key: string): Promise<void> | undefined {
  return loads.get(family)?.get(key);
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
  const exact = variantLoad(family, key);
  if (exact) return [...out, exact];
  if (registry.has(family) || atlasPending(family)) return [...out, ...familyLoads(family)];
  if (outlines || isExplicitCanvasFont(family) || getFontFallbackPolicy() !== 'substitute') return out;
  const fallback = getDefaultFontFamily() ?? firstRegisteredFamily();
  return fallback !== null && fallback !== family ? [...out, ...variantLoads(fallback, weight, style)] : out;
}

/** Is an atlas for this family on its way — declared lazily or fetching? */
export function atlasPending(family: string): boolean {
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
export function isFontPending(family: string, weight = 400, style: FontStyle = 'normal'): boolean {
  if (atlasPending(family)) return true;
  const outline = outlineStatus(family, weight, style);
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
  const entry = getAtlasFont(family, weight, style);
  if (!entry) return false;
  textureCache.upload(textureCacheKey(family, weight, style), entry.bitmap);
  return true;
}

export { textureCacheKey } from './textureCacheKey';
export type { ResolveResult } from './resolveResult';

/** The first family an app registered that has, or will have, an atlas. */
export function firstRegisteredFamily(): string | null {
  for (const family of registeredFamilies) {
    if (registry.has(family) || atlasPending(family)) return family;
  }
  return null;
}

