import { contrast, deltaE, hueGap } from './oklch.ts';
import type { Stats, Swatch } from './generate.ts';
import { maxOf, minOf } from '@weasel-js/geom';

/** Closest any two colors in the set look. */
function pairwiseMin(hexes: string[]): number {
  if (hexes.length < 2) return 1;
  let min = Infinity;
  for (let i = 0; i < hexes.length; i += 1) {
    for (let j = i + 1; j < hexes.length; j += 1) min = Math.min(min, deltaE(hexes[i], hexes[j]));
  }
  return min;
}

/** A palette's {@link Stats}, measured against `surface`. */
export function summarize(swatches: Swatch[], surface: string): Stats {
  const cs = swatches.map((s) => s.lch.C);
  const ls = swatches.map((s) => s.lch.L);
  let gap = 360;
  for (let i = 0; i < swatches.length; i += 1) {
    for (let j = i + 1; j < swatches.length; j += 1) {
      gap = Math.min(gap, hueGap(swatches[i].lch.H, swatches[j].lch.H));
    }
  }
  const none = swatches.length === 0;
  return {
    meanChroma: cs.reduce((a, b) => a + b, 0) / (cs.length || 1),
    chromaSpread: none ? 0 : maxOf(cs) - minOf(cs),
    lightnessSpread: none ? 0 : maxOf(ls) - minOf(ls),
    minHueGap: swatches.length > 1 ? gap : 360,
    hueFloorShare: swatches.length > 1 ? (gap * swatches.length) / 360 : 1,
    // An empty set's minimums are the best each can be, as `minHueGap` and `minDistance` are for fewer than two.
    minContrast: none ? 21 : minOf(swatches, (s) => contrast(s.hex, surface)),
    minSurfaceDistance: none ? 1 : minOf(swatches, (s) => deltaE(s.hex, surface)),
    minDistance: pairwiseMin(swatches.map((s) => s.hex)),
  };
}
