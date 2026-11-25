/**
 * `polygon-clipping`'s four operations, made to survive its one known failure: two vertices a rounding error
 * apart (a float32 corner beside the same corner in doubles) can leave it unable to close an output ring, and it
 * throws. Each operation runs as given first; only after a throw is it rerun with every coordinate snapped to a
 * grid scaled to the inputs, finer grids first, so near-coincident vertices become coincident ones, which it
 * handles. The coarsest grid is 2^-24 of the inputs' size, float32's resolution at that size. A grid is skipped
 * where its step passes 2^-10 of the inputs' extent: snapped that coarsely, a small shape far from the origin
 * would come back out of shape, and the throw is the better answer.
 */
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon } from './adapter';

type Clip = (head: MultiPolygon, ...rest: MultiPolygon[]) => MultiPolygon;

const GRIDS = [2 ** -40, 2 ** -30, 2 ** -24];
const MOST_SHIFT = 2 ** -10;

/** The largest coordinate's magnitude, and the larger side of the bounding box. */
function sizeOf(inputs: readonly MultiPolygon[]): { size: number; extent: number } {
  let size = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const mp of inputs) for (const poly of mp) for (const ring of poly) for (const [x, y] of ring) {
    size = Math.max(size, Math.abs(x), Math.abs(y));
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { size, extent: Math.max(x1 - x0, y1 - y0) };
}

function snapped(mp: MultiPolygon, step: number): MultiPolygon {
  const at = (v: number): number => Math.round(v / step) * step;
  return mp.map((poly) => poly.map((ring) => ring.map(([x, y]) => [at(x), at(y)] as [number, number])));
}

function robust(clip: Clip): Clip {
  return (head, ...rest) => {
    try {
      return clip(head, ...rest);
    } catch (first) {
      const { size, extent } = sizeOf([head, ...rest]);
      if (!(size > 0)) throw first;
      for (const grid of GRIDS) {
        const step = size * grid;
        if (step > extent * MOST_SHIFT) break;
        try {
          return clip(snapped(head, step), ...rest.map((mp) => snapped(mp, step)));
        } catch {
          // A coarser grid next.
        }
      }
      throw first;
    }
  };
}

export const clipper = {
  union: robust(polygonClipping.union as Clip),
  intersection: robust(polygonClipping.intersection as Clip),
  difference: robust(polygonClipping.difference as Clip),
  xor: robust(polygonClipping.xor as Clip),
};
