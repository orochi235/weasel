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
