import { trimNumber } from '@weasel-js/geom';

/** An SVG path through `pts`, as straight segments, each coordinate to two places. */
export function pathThrough(pts: readonly { readonly x: number; readonly y: number }[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${trimNumber(p.x, 2)},${trimNumber(p.y, 2)}`).join('');
}
