/**
 * Carrying corner specs onto a path rebuilt from another: a split, a rejoin,
 * a reversal. Specs are keyed by flat anchor index, so a rewrite that moves
 * anchors must renumber them rather than keep the old array.
 */
import { forEachSegment, pathCommandCoordCount, PATH_C, PATH_M, PATH_Q, PATH_Z } from '../commands';
import type { PolygonPath } from '../path';
import { compactCorners, withoutCorners, type CornerSpec } from './cornerSpec';

const flatCache = new WeakMap<PolygonPath, Int32Array>();

/**
 * For each anchor command of `path` (each M, L, C, or Q, as `countPathAnchors`
 * numbers them), its flat anchor index, the numbering `PolygonPath.corners`
 * uses: a closing curve that ends on its subpath's first point folds onto
 * that anchor, as `pathToAnchors` folds it.
 */
export function flatAnchorIndices(path: PolygonPath): Int32Array {
  const hit = flatCache.get(path);
  if (hit) return hit;
  const { commands, coords } = path;
  const out: number[] = [];
  let flat = 0, first = 0, count = 0;
  let sx = 0, sy = 0, ex = 0, ey = 0, curve = false;
  forEachSegment(commands, coords, (cmd, ci) => {
    if (cmd === PATH_Z) {
      if (count > 1 && curve && ex === sx && ey === sy) { out[out.length - 1] = first; flat--; }
      count = 0;
      return;
    }
    const n = pathCommandCoordCount(cmd);
    ex = coords[ci + n - 2]; ey = coords[ci + n - 1];
    curve = cmd === PATH_C || cmd === PATH_Q;
    if (cmd === PATH_M || count === 0) { first = flat; sx = ex; sy = ey; count = 0; }
    count++;
    out.push(flat++);
  });
  const result = Int32Array.from(out);
  flatCache.set(path, result);
  return result;
}

/**
 * `to` with `from`'s corner specs carried across, where `sources[k]` is the
 * anchor command of `from` that anchor command `k` of `to` was drawn from, or
 * -1 for one with no source. Each spec lands once, on the first anchor drawn
 * from its own; any specs `to` already had are dropped.
 */
export function carryCorners(from: PolygonPath, to: PolygonPath, sources: ArrayLike<number>): PolygonPath {
  const bare = withoutCorners(to);
  const specs = from.corners;
  if (!specs) return bare;
  const fromFlat = flatAnchorIndices(from);
  const toFlat = flatAnchorIndices(to);
  const placed = new Set<number>();
  const next: (CornerSpec | null)[] = [];
  for (let k = 0; k < toFlat.length; k++) {
    const s = sources[k];
    if (s === undefined || s < 0 || s >= fromFlat.length) continue;
    const f = fromFlat[s];
    const spec = specs[f];
    if (!spec || placed.has(f)) continue;
    placed.add(f);
    while (next.length < toFlat[k]) next.push(null);
    next[toFlat[k]] = spec;
  }
  const corners = compactCorners(next);
  return corners ? { ...bare, corners } : bare;
}

/** `count` consecutive anchor command indices from `start`: the sources of a
 *  contiguous slice. */
export function anchorRange(start: number, count: number): Int32Array {
  const out = new Int32Array(count);
  for (let i = 0; i < count; i++) out[i] = start + i;
  return out;
}
