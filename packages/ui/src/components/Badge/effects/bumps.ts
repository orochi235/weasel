import { wrapPositive } from '@weasel-js/geom';
/** The bump of an evenly spaced run around a closed outline that lies nearest a sample. */
export interface NearestBump {
  /** Which bump, in `[0, count)`: the same bump on both sides of the outline's start. */
  index: number;
  /** The bump's center, as arc length in `[0, totalCss)`. */
  center: number;
  /** The sample's signed distance from that center along the outline, the shorter way round. */
  offset: number;
}

/**
 * The nearest of `count` bumps spaced evenly round an outline `totalCss` long, centered at
 * `(index + phase) * totalCss / count`.
 */
export function nearestBump(s: number, totalCss: number, count: number, phase: number): NearestBump {
  const step = totalCss / count;
  const phaseOffset = phase * step;
  const sm = wrapPositive(s, totalCss);
  const k = Math.round((sm - phaseOffset) / step);
  const index = wrapPositive(k, count);
  const center = wrapPositive(k * step + phaseOffset, totalCss);
  let offset = sm - center;
  if (offset > totalCss / 2) offset -= totalCss;
  if (offset < -totalCss / 2) offset += totalCss;
  return { index, center, offset };
}

/** A bump's fixed pseudo-random wobble in `[-1, 1]`, by its index. */
export function bumpWobble(index: number): number {
  return Math.sin(index * 1.73 + 0.7);
}

/**
 * The radius of bump `index`, `radius` widened or narrowed by up to 55% at full `irregularity`,
 * and never past half of `step` so it ends before its neighbor's begins.
 */
export function bumpRadius(radius: number, irregularity: number, index: number, step: number): number {
  const irr = Math.max(0, Math.min(irregularity, 1));
  return Math.min(radius * (1 + irr * 0.55 * bumpWobble(index)), step / 2);
}
