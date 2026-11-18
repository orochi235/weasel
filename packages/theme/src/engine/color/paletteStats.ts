import { contrast, deltaE, hueGap } from './oklch.ts';
import type { Stats, Swatch } from './generate.ts';

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
  return {
    meanChroma: cs.reduce((a, b) => a + b, 0) / (cs.length || 1),
    chromaSpread: Math.max(...cs) - Math.min(...cs),
    lightnessSpread: Math.max(...ls) - Math.min(...ls),
    minHueGap: swatches.length > 1 ? gap : 360,
    hueFloorShare: swatches.length > 1 ? (gap * swatches.length) / 360 : 1,
    minContrast: Math.min(...swatches.map((s) => contrast(s.hex, surface))),
    minSurfaceDistance: Math.min(...swatches.map((s) => deltaE(s.hex, surface))),
    minDistance: pairwiseMin(swatches.map((s) => s.hex)),
  };
}
