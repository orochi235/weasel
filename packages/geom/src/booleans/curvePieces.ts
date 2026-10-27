/**
 * Divide, face pieces, trim and merge that keep curves: one cut of every
 * outline against the others, its edges labeled by which inputs cover each
 * side, and each label's boundary traced into loops.
 */

import type { Path, PolygonPath } from '../path';
import { type Contour, sampleContour, signedArea } from './contourSegments';
import { assembleRegions } from './cutRegions';
import { type CurveCut, cutPaths, curveRegions, writeLoops } from './curveBoolean';

export interface CurvePiece {
  path: PolygonPath;
  sources: number[];
}

const covering = (inside: boolean[]): number[] => {
  const s: number[] = [];
  inside.forEach((v, i) => { if (v) s.push(i); });
  return s;
};

const maskOf = (sources: readonly number[]): bigint => sources.reduce((m, i) => m | (1n << BigInt(i)), 0n);

/** Left edge, then bottom, of a region's outer loop. */
function corner(loops: readonly Contour[]): [number, number] {
  const pts = sampleContour(loops[0]);
  let x = Infinity, y = Infinity;
  for (let i = 0; i < pts.length; i += 2) { x = Math.min(x, pts[i]); y = Math.min(y, pts[i + 1]); }
  return [x, y];
}

/** Loops with their region on the left, as connected regions: each outer loop with the holes it holds. */
function connected(loops: readonly Contour[]): Contour[][] {
  const outers: Contour[] = [], holes: Contour[] = [];
  for (const l of loops) (signedArea(l) > 0 ? outers : holes).push(l);
  return assembleRegions(outers, holes);
}

/**
 * The faces the paths' outlines cut the plane into, grouped by the inputs
 * covering them: one piece per cover set, or with `split` one per connected
 * face. Ordered as `pathDividePieces` orders them. Null where `cutPaths` or
 * `curveRegions` is.
 */
export function curveDivide(paths: readonly Path[], split: boolean): CurvePiece[] | null {
  const cut = cutPaths(paths);
  if (!cut) return null;
  const ids = new Map<string, number>();
  const sets: number[][] = [];
  const regions = curveRegions(cut, (inside) => {
    const s = covering(inside);
    if (s.length === 0) return -1;
    const key = s.join(',');
    let id = ids.get(key);
    if (id === undefined) { id = sets.length; ids.set(key, id); sets.push(s); }
    return id;
  });
  if (!regions) return null;

  const out: { piece: CurvePiece; mask: bigint; at: [number, number] }[] = [];
  for (const [id, loops] of regions) {
    const sources = sets[id];
    const mask = maskOf(sources);
    for (const face of split ? connected(loops) : [loops]) {
      out.push({ piece: { path: writeLoops(face, cut.clockwise[sources[0]]), sources }, mask, at: corner(face) });
    }
  }
  return out.sort((a, b) =>
    a.piece.sources.length - b.piece.sources.length
    || (a.mask < b.mask ? -1 : a.mask > b.mask ? 1 : 0)
    || a.at[0] - b.at[0] || a.at[1] - b.at[1]).map((o) => o.piece);
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
