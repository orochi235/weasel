/**
 * Trim and merge that keep curves: one cut of every outline against the
 * others, its edges labeled by which inputs cover each side, and each label's
 * boundary traced into loops.
 */

import type { Path, PolygonPath } from '../path';
import type { Contour } from './contourSegments';
import { type CurveCut, cutPaths, curveRegions, writeLoops } from './curveBoolean';

export interface CurvePiece {
  path: PolygonPath;
  sources: number[];
}

const topmost = (inside: boolean[]): number => inside.lastIndexOf(true);

/** Each input's part left showing, keyed by input; inputs wholly hidden have none. */
function shown(cut: CurveCut): Map<number, Contour[]> | null {
  return curveRegions(cut, topmost);
}

/** `pathTrim` with curves kept. Null where `cutPaths` or `curveRegions` is. */
export function curveTrim(paths: readonly Path[]): CurvePiece[] | null {
  const cut = cutPaths(paths);
  const regions = cut && shown(cut);
  if (!cut || !regions) return null;
  return [...regions.keys()].sort((a, b) => a - b)
    .map((i) => ({ path: writeLoops(regions.get(i)!, cut.clockwise[i]), sources: [i] }));
}

/** `pathMerge` with curves kept. Null where `cutPaths` or `curveRegions` is. */
export function curveMerge(paths: readonly Path[], keyOf: (index: number) => unknown): CurvePiece[] | null {
  const cut = cutPaths(paths);
  const visible = cut && shown(cut);
  if (!cut || !visible) return null;
  const groupIds = new Map<unknown, number>();
  const groupOf = paths.map((_, i) => {
    const key = keyOf(i);
    let g = groupIds.get(key);
    if (g === undefined) { g = groupIds.size; groupIds.set(key, g); }
    return g;
  });
  const regions = curveRegions(cut, (inside) => {
    const top = topmost(inside);
    return top < 0 ? -1 : groupOf[top];
  });
  if (!regions) return null;
  const pieces: CurvePiece[] = [];
  for (const [g, loops] of regions) {
    const sources = [...visible.keys()].filter((i) => groupOf[i] === g).sort((a, b) => a - b);
    pieces.push({ path: writeLoops(loops, cut.clockwise[sources[0]]), sources });
  }
  return pieces.sort((a, b) => a.sources[a.sources.length - 1] - b.sources[b.sources.length - 1]);
}
