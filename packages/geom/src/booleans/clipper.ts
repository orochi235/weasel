/**
 * `polygon-clipping`'s four operations, made to survive its one known failure: two vertices a rounding error
 * apart (a float32 corner beside the same corner in doubles) can leave it unable to close an output ring, and it
 * throws. Each operation runs as given first; only after a throw is it rerun with every coordinate snapped to a
 * grid scaled to the inputs, finer grids first, so near-coincident vertices become coincident ones, which it
 * handles. The coarsest grid is the kernel's `EPS` of the inputs' size, below float32 storage resolution.
 */
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon } from './adapter';
import { EPS } from '../scalar';

type Clip = (head: MultiPolygon, ...rest: MultiPolygon[]) => MultiPolygon;

const GRIDS = [2 ** -40, 2 ** -30, EPS];

function sizeOf(inputs: readonly MultiPolygon[]): number {
  let most = 0;
  for (const mp of inputs) for (const poly of mp) for (const ring of poly) for (const [x, y] of ring) {
    most = Math.max(most, Math.abs(x), Math.abs(y));
  }
  return most;
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
      const size = sizeOf([head, ...rest]);
      if (!(size > 0)) throw first;
      for (const grid of GRIDS) {
        const step = size * grid;
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
