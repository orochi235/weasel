import {
  forEachSegment, nearestOnPath, PATH_C, PATH_M, PATH_Q, PATH_Z, worldCoords, type PointOrigin, type PolygonPath,
} from '@weasel-js/geom';

/** For each point of `path`, the segment it ends: the index of the point it starts from, or -1 for a point
 *  that ends none (a move or a control point). */
function segmentStarts(path: PolygonPath): Int32Array {
  const starts = new Int32Array(path.coords.length >> 1).fill(-1);
  let last = -1;
  forEachSegment(path.commands, path.coords, (cmd, ci) => {
    if (cmd === PATH_Z) return;
    const end = (ci + (cmd === PATH_C ? 6 : cmd === PATH_Q ? 4 : 2) - 2) >> 1;
    if (cmd !== PATH_M) starts[end] = last;
    last = end;
  });
  return starts;
}

/**
 * Where each anchor of `piece`, a run cut out of `whole`, lies on `whole`: on an anchor of it, or a
 * blend of the way along the segment between two, as `anchorDataPatch` reads an edit's origins. Indexed
 * by point of `piece`; a control point has none.
 */
export function pieceOrigins(whole: PolygonPath, piece: PolygonPath): (PointOrigin | null)[] {
  const from = worldCoords(whole);
  const at = worldCoords(piece);
  const out: (PointOrigin | null)[] = new Array(piece.coords.length >> 1).fill(null);
  // Where each subpath of `whole` begins, for the edge its Z closes.
  const subStart = new Map<number, number>();
  let begun = 0;
  forEachSegment(whole.commands, whole.coords, (cmd, ci, _x, _y, k) => {
    if (cmd === PATH_M) begun = ci >> 1;
    else if (cmd === PATH_Z) subStart.set(k, begun);
  });
  const starts = segmentStarts(whole);
  forEachSegment(piece.commands, piece.coords, (cmd, ci) => {
    if (cmd === PATH_Z) return;
    const p = (ci + (cmd === PATH_C ? 6 : cmd === PATH_Q ? 4 : 2) - 2) >> 1;
    const hit = nearestOnPath(whole.commands, from, at[2 * p], at[2 * p + 1]);
    if (hit === null) return;
    const zStart = subStart.get(hit.commandIndex);
    const cmdAt = whole.commands[hit.commandIndex];
    const end = zStart ?? ((hit.coordIndex + (cmdAt === PATH_C ? 6 : cmdAt === PATH_Q ? 4 : 2) - 2) >> 1);
    const start = zStart === undefined ? starts[end] : (hit.coordIndex >> 1) - 1;
    if (start < 0) return;
    if (hit.t <= 0) out[p] = { a: start, b: start, t: 0 };
    else if (hit.t >= 1) out[p] = { a: end, b: end, t: 0 };
    else out[p] = { a: start, b: end, t: hit.t };
  });
  return out;
}
