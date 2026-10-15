import type { PolygonPath } from '../path';
import type { Point } from './cubicMath';
import { anchorsToPath, pathToAnchors, type PenAnchor } from './anchors';

/** What stays put of a path while some of its anchors move. */
export interface PathAwayFromAnchors {
  /** The segments touching none of the moving anchors, as open runs; a
   *  subpath none of them is on stays as it was. */
  path: PolygonPath;
  /** Every anchor that is not moving, a lone one with no segment left at it
   *  included. */
  anchors: Point[];
}

/** An open run of `sub` from anchor `from` through `count` segments, its
 *  outer handles dropped. */
function run(sub: readonly PenAnchor[], from: number, count: number): PenAnchor[] {
  const out: PenAnchor[] = [];
  for (let j = 0; j <= count; j++) out.push({ ...sub[(from + j) % sub.length] });
  delete out[0].inHandle;
  delete out[out.length - 1].outHandle;
  return out;
}

/**
 * The part of `path` that holds still while the anchors at `moving` (flat
 * indices, as anchor editing numbers them) are dragged: every segment with a
 * moving anchor at either end is dropped, and so are the moving anchors.
 */
export function pathAwayFromAnchors(path: PolygonPath, moving: Iterable<number>): PathAwayFromAnchors {
  const set = pathToAnchors(path);
  const flat = new Set(moving);
  const subs: PenAnchor[][] = [];
  const closed: boolean[] = [];
  const anchors: Point[] = [];
  let base = 0;
  set.anchors.forEach((sub, s) => {
    const n = sub.length;
    const moves = (i: number) => flat.has(base + (i % n));
    for (let i = 0; i < n; i++) if (!moves(i)) anchors.push({ x: sub[i].x, y: sub[i].y });
    const first = sub.findIndex((_, i) => moves(i));
    if (first < 0) {
      subs.push(sub);
      closed.push(set.closed[s]);
    } else {
      // A closed subpath is walked from a moving anchor, so no kept run wraps.
      const start = set.closed[s] ? first : 0;
      const segs = set.closed[s] ? n : n - 1;
      let runFrom = -1;
      for (let j = 0; j <= segs; j++) {
        const k = start + j;
        const kept = j < segs && !moves(k) && !moves(k + 1);
        if (kept && runFrom < 0) runFrom = k;
        if (!kept && runFrom >= 0) {
          subs.push(run(sub, runFrom % n, k - runFrom));
          closed.push(false);
          runFrom = -1;
        }
      }
    }
    base += n;
  });
  return { path: anchorsToPath(subs, closed, path), anchors };
}
