import { forEachSegment, PATH_C, PATH_L, PATH_M, PATH_Q } from '../commands';
import type { Path, PolygonPath } from '../path';
import { resolveCornersWithSources } from '../paths/corners';
import { extractPolylines, type Polyline } from '../tessellate/polyline';
import { closingAnchor, lengthTable, type LengthRun, type LengthTable } from './lengthTable';

const tables = new WeakMap<Path, LengthTable>();

/**
 * The exact length table of `path` as a stroke draws it: corners resolved,
 * each curve measured by its arc length rather than by any flattening of it,
 * anchors in authored numbering. Its runs are `extractPolylines`' subpaths,
 * one point per anchor, with each curve's control points, so a curve position
 * on it names the same place on every flattening of the path. Kept per path.
 */
export function pathLengthTable(path: Path): LengthTable {
  const hit = tables.get(path);
  if (hit) return hit;
  let table: LengthTable;
  if (path.kind === 'rect') {
    table = lengthTable(extractPolylines(path), 2);
  } else {
    const { path: resolved, anchorSources } = resolveCornersWithSources(path);
    const controls = controlsByAnchor(resolved);
    table = lengthTable(extractPolylines(resolved).map((pl) => anchorRun(pl, controls)), 2, anchorSources);
  }
  tables.set(path, table);
  return table;
}

/** Per anchor, in `extractPolylines`' numbering, the control points of the curve arriving at it; null for a line or a move. */
function controlsByAnchor(path: PolygonPath): (number[] | null)[] {
  const out: (number[] | null)[] = [];
  const { commands, coords } = path;
  forEachSegment(commands, coords, (cmd, ci) => {
    if (cmd === PATH_M || cmd === PATH_L) out.push(null);
    else if (cmd === PATH_Q) out.push([coords[ci], coords[ci + 1]]);
    else if (cmd === PATH_C) out.push([coords[ci], coords[ci + 1], coords[ci + 2], coords[ci + 3]]);
  });
  return out;
}

/** `pl` reduced to its anchors, each segment between them carrying its curve's controls. */
function anchorRun(pl: Polyline, controls: readonly (number[] | null)[]): LengthRun {
  const n = pl.points.length / 2;
  const { anchorA: A, anchorB: B } = pl;
  const points: number[] = [];
  const ids: number[] = [];
  for (let i = 0; i < n; i++) {
    if (A && B && A[i] !== B[i]) continue;
    points.push(pl.points[i * 2], pl.points[i * 2 + 1]);
    ids.push(A ? A[i] : i);
  }
  const segControls = ids.slice(1).map((id) => controls[id] ?? null);
  const close = closingAnchor(pl);
  if (pl.closed && n >= 2) segControls.push(close === undefined ? null : controls[close] ?? null);
  const anchors = Uint32Array.from(ids);
  return {
    points,
    closed: pl.closed,
    anchorA: anchors,
    anchorB: anchors.slice(),
    anchorT: new Float32Array(ids.length),
    ...(close !== undefined ? { closeAnchor: close } : {}),
    controls: segControls,
  };
}
