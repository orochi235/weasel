/**
 * FontRegistry and registerFont() public API.
 *
 * Variants are keyed by (family, weight, style). registerFont() takes a
 * FontVariant alongside the family and the two URLs; the registry stores
 * entries in a two-level Map so resolveFontVariant() can iterate a family's
 * variants for the fallback chain.
 */

import { parseBmFont, type BmFont } from './FontAtlas';
import type { GlyphTextureSink } from './textureSink';
import {
  isCanvasFont, isExplicitCanvasFont, autoEnrollCanvasFont, getDynamicFace,
  type DynamicFace,
} from './dynamic/dynamicAtlas';
import { getFontFallbackPolicy, getDefaultFontFamily } from './fallback';

export interface FontEntry {
  font: BmFont;
  bitmap: ImageBitmap;
}

export interface FontVariant {
  weight?: number;
  style?: 'normal' | 'italic';
}

type FontStyle = 'normal' | 'italic';

let registry = new Map<string, Map<string, FontEntry>>();

function variantKey(weight: number, style: FontStyle): string {
  return `${weight}|${style}`;
}

function normalizeVariant(v: FontVariant): { weight: number; style: FontStyle } {
  return {
    weight: v.weight ?? 400,
    style: v.style ?? 'normal',
  };
}

/** Test helper. Do not call from product code. */
export function _resetFontRegistryForTests(): void {
  registry = new Map();
  warnedMissingFamilies.clear();
}

/** Exact lookup — does NOT walk the fallback chain. Use `resolveFontVariant` for that. */
export function getFont(
  family: string,
  weight: number = 400,
  style: FontStyle = 'normal',
): FontEntry | null {
  return registry.get(family)?.get(variantKey(weight, style)) ?? null;
}

export interface RegisteredFont {
  family: string;
  variants: readonly { weight: number; style: FontStyle }[];
}

/**
 * Enumerate the registry — what a font picker can honestly offer. Families
 * come back in registration order; variants sorted by weight, then style, so
 * the output is stable enough to assert against.
 */
export function listFonts(): readonly RegisteredFont[] {
  const out: RegisteredFont[] = [];
  for (const [family, variantMap] of registry) {
    const variants = [...variantMap.keys()]
      .map((key) => {
        const [w, s] = key.split('|') as [string, FontStyle];
        return { weight: Number(w), style: s };
      })
      .sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));
    out.push({ family, variants });
  }
  return out;
}

export async function registerFont(
  family: string,
  variant: FontVariant,
  metricsUrl: string,
  atlasUrl: string,
): Promise<void> {
  const { weight, style } = normalizeVariant(variant);
  const key = variantKey(weight, style);

  if (registry.get(family)?.has(key)) return;

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

    // Re-read the registry here (not the pre-await snapshot): concurrent
    // registerFont() calls for other variants of the same family (e.g. the
    // 400/700 weights registered together in Promise.all) may have created
    // the family's Map while this call was awaiting its fetch. Reusing a
    // stale local reference would recreate the Map and silently drop
    // whichever variant's registerFont() resolved first.
    let familyMap = registry.get(family);
    if (!familyMap) {
      familyMap = new Map();
      registry.set(family, familyMap);
    }
    familyMap.set(key, { font, bitmap });
  } catch (err) {
    throw new Error(
      `weasel registerFont("${family}" ${weight}/${style}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
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

/** The texture cache key used by `ensureFontTexture` for a given variant. */
export function textureCacheKey(family: string, weight: number, style: FontStyle): string {
  return `${family}|${weight}|${style}`;
}

/** Kept as a no-op for context-restore call sites; per-cache dedup handles it now. */
export function markAllFontsNotUploaded(): void {}

export interface ResolveResult {
  entry: FontEntry | null;
  /**
   * The (family, weight, style) triple that was actually matched. May differ
   * from the requested values when the resolver walked the fallback chain —
   * including `family`, when the cross-family policy substituted a default.
   *
   * This is the atlas identity: pass all three to `getFont` /
   * `textureCacheKey` and the lookup hits. Describing only weight and style
   * here once let a caller key its draw on the *requested* family, which
   * resolves to no atlas at all and paints nothing.
   *
   * The synthetic flags describe the gap between requested and resolved for
   * shader-side compensation. When `entry` is null, these mirror the
   * requested values.
   */
  resolved: { family: string; weight: number; style: FontStyle };
  synthetic: { bold: boolean; italic: boolean };
  /** Which tier resolved: a baked MSDF atlas, or the runtime canvas-SDF
   *  dynamic atlas. Misses report 'atlas' (the default tier). */
  source: 'atlas' | 'canvas';
  /** Set only when source === 'canvas': the dynamic face whose BmFont-shaped
   *  `font` layoutRuns consumes in place of `entry.font`. */
  dynamicFace?: DynamicFace;
  /**
   * Set when the requested family was not registered and the fallback policy
   * substituted a different one. Reported structurally so a UI can say
   * "Inter — not loaded, showing Roboto" instead of leaving the user to
   * wonder why the family control did nothing.
   */
  substituted?: { requested: string; resolved: string };
}

function missResolveResult(family: string, weight: number, style: FontStyle): ResolveResult {
  // Canvas-dynamic tier: reached only when the fallback chain selected no
  // baked variant, so any selected baked match always wins. Dynamic faces
  // rasterize the real weight/style — no synthetic flags.
  //
  // Explicit enrollment only. A family the `'canvas'` policy enrolled for
  // itself must not keep routing here after the policy changes, or `'none'`
  // could never restore the hard miss it documents once any family had been
  // auto-enrolled.
  if (isExplicitCanvasFont(family)) {
    return {
      entry: null,
      dynamicFace: getDynamicFace(family, weight, style),
      resolved: { family, weight, style },
      synthetic: { bold: false, italic: false },
      source: 'canvas',
    };
  }

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
    // reject `setDefaultFontFamily` pointed at one.
    if (fallback !== null && fallback !== family && (registry.has(fallback) || isCanvasFont(fallback))) {
      const result = resolveFontVariant(fallback, weight, style);
      // Renderable, not baked: a fallback served by the dynamic tier reports
      // `entry: null` with a dynamicFace, and testing entry alone threw it away.
      if (result.entry !== null || result.dynamicFace !== undefined) {
        warnMissingFamilyOnce(family, weight, style, fallback);
        return { ...result, substituted: { requested: family, resolved: fallback } };
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

/** Insertion order of the registry Map — the first family an app registered. */
function firstRegisteredFamily(): string | null {
  for (const family of registry.keys()) return family;
  return null;
}

// Resolution runs per frame, so an unguarded warn would flood the console.
// Keyed per (family, weight, style) variant, not per family: each variant is a
// distinct thing the app asked for and failed to get.
const warnedMissingFamilies = new Set<string>();

function warnMissingFamilyOnce(
  family: string, weight: number, style: FontStyle, resolved: string,
): void {
  const key = `${family}|${weight}|${style}`;
  if (warnedMissingFamilies.has(key)) return;
  warnedMissingFamilies.add(key);
  // Two distinct failures land here. Saying "not registered" for a family
  // that IS registered — just not in a variant the within-family chain can
  // reach — sends the reader hunting for a registerFont call that already
  // exists. Name the actual gap so the fix is the obvious one.
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
  const familyMap = registry.get(family);
  if (!familyMap || familyMap.size === 0) return missResolveResult(family, weight, style);

  // 1. Exact match
  const exact = familyMap.get(variantKey(weight, style));
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

  return missResolveResult(family, weight, style);
}
