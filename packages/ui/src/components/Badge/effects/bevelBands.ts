import { trimNumber } from '@weasel-js/geom';
import type { BaseSampler } from '../bases/types';

const SAMPLES = 240;

/** One band of a bevel: a run of the perimeter that shares a shade, inset by the bevel's width. */
export interface BevelBand<K> {
  key: K;
  /** Closed path data in viewBox units. */
  d: string;
}

/**
 * Splits a bevel `bevelWidth` CSS px wide into bands by `keyFor` of each sample's outward normal.
 * Each band reaches one sample into its neighbors, so the seams between bands leave no gap.
 */
export function bevelBands<K>(
  sampler: BaseSampler,
  boxW: number,
  boxH: number,
  bevelWidth: number,
  keyFor: (nx: number, ny: number) => K,
): BevelBand<K>[] {
  const sx = 100 / boxW;
  const sy = 100 / boxH;
  const total = sampler.totalCss;
  const outer: { x: number; y: number }[] = [];
  const inner: { x: number; y: number }[] = [];
  const keys: K[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const pt = sampler.perimeterAt((i / SAMPLES) * total);
    outer.push({ x: pt.x, y: pt.y });
    inner.push({ x: pt.x - pt.nx * bevelWidth * sx, y: pt.y - pt.ny * bevelWidth * sy });
    keys.push(keyFor(pt.nx, pt.ny));
  }

  const runs: { key: K; idxs: number[] }[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const last = runs[runs.length - 1];
    if (last && last.key === keys[i]) last.idxs.push(i);
    else runs.push({ key: keys[i], idxs: [i] });
  }
  if (runs.length > 1 && runs[0].key === runs[runs.length - 1].key) {
    runs[runs.length - 1].idxs.push(...runs[0].idxs);
    runs.shift();
  }

  return runs.map(({ key, idxs }) => {
    if (runs.length > 1) {
      idxs = [(idxs[0] - 1 + SAMPLES) % SAMPLES, ...idxs, (idxs[idxs.length - 1] + 1) % SAMPLES];
    }
    const pts = [...idxs.map((i) => outer[i]), ...idxs.map((i) => inner[i]).reverse()];
    let d = `M ${trimNumber(pts[0].x, 3)} ${trimNumber(pts[0].y, 3)}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${trimNumber(pts[i].x, 3)} ${trimNumber(pts[i].y, 3)}`;
    return { key, d: d + ' Z' };
  });
}
