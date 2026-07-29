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
import { isCanvasFont, getDynamicFace, type DynamicFace } from './dynamic/dynamicAtlas';

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
}

/** Exact lookup — does NOT walk the fallback chain. Use `resolveFontVariant` for that. */
export function getFont(
  family: string,
  weight: number = 400,
  style: FontStyle = 'normal',
): FontEntry | null {
  return registry.get(family)?.get(variantKey(weight, style)) ?? null;
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
   * The (weight, style) pair that was actually matched. May differ from
   * the requested values when the resolver walked the fallback chain.
   * Use these for cache-key lookup; the synthetic flags describe the
   * gap between requested and resolved for shader-side compensation.
   * When `entry` is null, these mirror the requested values.
   */
  resolved: { weight: number; style: FontStyle };
  synthetic: { bold: boolean; italic: boolean };
  /** Which tier resolved: a baked MSDF atlas, or the runtime canvas-SDF
   *  dynamic atlas. Misses report 'atlas' (the default tier). */
  source: 'atlas' | 'canvas';
  /** Set only when source === 'canvas': the dynamic face whose BmFont-shaped
   *  `font` layoutRuns consumes in place of `entry.font`. */
  dynamicFace?: DynamicFace;
}

function missResolveResult(family: string, weight: number, style: FontStyle): ResolveResult {
  // Canvas-dynamic tier: reached only when the fallback chain selected no
  // baked variant, so any selected baked match always wins. Dynamic faces
  // rasterize the real weight/style — no synthetic flags.
  if (isCanvasFont(family)) {
    return {
      entry: null,
      dynamicFace: getDynamicFace(family, weight, style),
      resolved: { weight, style },
      synthetic: { bold: false, italic: false },
      source: 'canvas',
    };
  }
  return {
    entry: null,
    resolved: { weight, style },
    synthetic: { bold: false, italic: false },
    source: 'atlas',
  };
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
      resolved: { weight, style },
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
      resolved: { weight: bestSameStyle.weight, style },
      synthetic: { bold: false, italic: false },
      source: 'atlas',
    };
  }

  // 3. (family, 400, style)
  const sameStyleRegular = familyMap.get(variantKey(400, style));
  if (sameStyleRegular) {
    return {
      entry: sameStyleRegular,
      resolved: { weight: 400, style },
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
      resolved: { weight, style: 'normal' },
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
      resolved: { weight: bestNormal.weight, style: 'normal' },
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
      resolved: { weight: 400, style: 'normal' },
      synthetic: {
        bold: weight >= 600,
        italic: style === 'italic',
      },
      source: 'atlas',
    };
  }

  return missResolveResult(family, weight, style);
}
