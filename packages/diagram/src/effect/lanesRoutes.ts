/** Routes for the `lanes` look: each wire kept clear of the stages it passes,
 *  and its label set where it covers no stage. */
import { pointAlongPath, type Path } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { EDGE_DERIVE_PATH } from '../edge';
import type { DiagramRouter, DiagramSpec } from '../fromData';
import { labelCenter } from '../label';

export type Box = { x: number; y: number; width: number; height: number };

/** Where a lanes chart's columns and lanes lie, and what stands in each column. */
export interface LaneGrid {
  /** Each column's left and right edge. */
  columns: readonly (readonly [number, number])[];
  /** Lane edges top down: the top of each lane, then the bottom of the last. */
  edges: readonly number[];
  /** What each column's stages draw: their boxes, and whatever they draw outside them. */
  ink: readonly (readonly Box[])[];
}

/** One end of a wire: the column its stage stands in, and where its port is. */
export interface LaneEnd {
  column: number;
  point: Vec2;
  /** The way the port faces, or null. */
  normal: Vec2 | null;
}

/** How far a wire keeps from anything a stage draws. */
const CLEAR = 3;

/** Whether a wire at `y`, or anywhere between `y` and `to`, comes within `CLEAR` of one of `boxes`. */
const covers = (boxes: readonly Box[], y: number, to = y): boolean =>
  boxes.some((b) => b.y - CLEAR < Math.max(y, to) && Math.min(y, to) < b.y + b.height + CLEAR);

/** The height nearest `near` at which a wire runs clear through every one of
 *  `columns`: a lane edge, or past the top or bottom of everything drawn. */
function corridor(grid: LaneGrid, columns: readonly number[], near: number): number {
  const ink = columns.flatMap((c) => grid.ink[c] ?? []);
  const top = Math.min(grid.edges[0] ?? 0, ...ink.map((b) => b.y)) - 2 * CLEAR;
  const bottom = Math.max(grid.edges[grid.edges.length - 1] ?? 0, ...ink.map((b) => b.y + b.height)) + 2 * CLEAR;
  const clear = [...grid.edges, top, bottom].filter((y) => !covers(ink, y));
  return clear.reduce((best, y) => (Math.abs(y - near) < Math.abs(best - near) ? y : best));
}

/** The columns from `a` to `b`, `a` and `b` included, in that order. */
const between = (a: number, b: number): number[] =>
  Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => a + Math.sign(b - a) * i);

/** Each column's height for a wire running forward from `from` to `to`: its
 *  own lane where that is clear, and around what stands there where not, one
 *  corridor for each stretch of columns in its way. Null when nothing between
 *  the two ends is in the way at all. */
function levels(grid: LaneGrid, from: LaneEnd, to: LaneEnd): number[] | null {
  const columns = Array.from({ length: to.column - from.column - 1 }, (_, i) => from.column + 1 + i);
  const inWay = (c: number) => covers(grid.ink[c] ?? [], from.point.y, to.point.y);
  const first = columns.findIndex(inWay);
  if (first < 0) return null;
  const want = columns.map((_, i) => (i < first ? from.point.y : to.point.y));
  const out = want.slice();
  for (let i = 0; i < columns.length;) {
    if (!covers(grid.ink[columns[i]!] ?? [], want[i]!)) {
      i++;
      continue;
    }
    let j = i;
    while (j < columns.length && covers(grid.ink[columns[j]!] ?? [], want[j]!)) j++;
    const y = corridor(grid, columns.slice(i, j), want[i]!);
    for (let k = i; k < j; k++) out[k] = y;
    i = j;
  }
  return out;
}

/** Points in order, a point level with the two either side of it dropped. */
function straightened(points: readonly Vec2[]): Vec2[] {
  return points.filter((p, i) => {
    const a = points[i - 1];
    const b = points[i + 1];
    return a === undefined || b === undefined || !(a.y === p.y && p.y === b.y);
  });
}

/** The waypoints a wire runs through to stay clear of every stage but its
 *  own two, or none when the straight route already does. A wire running
 *  forward holds a level run through each column it crosses and changes
 *  height only in the gaps between; one running back turns in the gap past
 *  each end and runs back along one corridor clear of every column it spans. */
export function laneWaypoints(grid: LaneGrid, from: LaneEnd, to: LaneEnd): Vec2[] | undefined {
  const edge = (c: number, side: 0 | 1) => grid.columns[c]![side];
  if (from.column >= to.column) {
    const y = corridor(grid, between(from.column, to.column), from.point.y);
    return [{ x: edge(from.column, 1), y }, { x: edge(to.column, 0), y }];
  }
  const ys = levels(grid, from, to);
  if (ys === null) return undefined;
  const points: Vec2[] = [];
  // A port short of its column's edge runs level out to it before turning,
  // past whatever else the column holds.
  const out = edge(from.column, 1);
  if (from.normal?.x === 1 && from.point.x < out - 1) points.push({ x: (from.point.x + out) / 2, y: from.point.y }, { x: out, y: from.point.y });
  ys.forEach((y, i) => points.push({ x: edge(from.column + 1 + i, 0), y }, { x: edge(from.column + 1 + i, 1), y }));
  const into = edge(to.column, 0);
  if (to.normal?.x === -1 && to.point.x > into + 1) points.push({ x: into, y: to.point.y }, { x: (to.point.x + into) / 2, y: to.point.y });
  return straightened(points);
}

/** The route a scene draws for an edge between two node specs, as
 *  `diagramScene` built them: the same derivation the scene runs. */
export function routeOf(
  from: DiagramSpec, fromPort: string, to: DiagramSpec, toPort: string, router: DiagramRouter, waypoints: readonly Vec2[] | undefined,
): Path | null {
  const dep = (s: DiagramSpec) => ({ node: { id: s.id, data: s.data }, pose: s.pose });
  const edge = { data: { diagram: { from: { port: fromPort }, to: { port: toPort }, router, ...(waypoints ? { waypoints } : {}) } } };
  return EDGE_DERIVE_PATH(edge, [dep(from), dep(to)] as never);
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Where along `path` to put a label `size` big, `offset` off it, so it
 *  covers none of `keepOut`: on the left of the route as near its middle as
 *  that allows, else on its right, else undefined. Answers the point to put
 *  it near, the side it takes as a signed offset, and the box it takes there. */
export function clearLabel(
  path: Path, size: { width: number; height: number }, offset: number, keepOut: readonly Box[],
): { near: Vec2; offset: number; box: Box } | undefined {
  for (const side of [offset, -offset]) {
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9]) {
      const near = pointAlongPath(path, t)?.point;
      const center = near === undefined ? null : labelCenter(path, { at: { near }, offset: side }, size);
      if (near === undefined || center === null) continue;
      const box = { x: center.x - size.width / 2, y: center.y - size.height / 2, width: size.width, height: size.height };
      if (!keepOut.some((k) => overlaps(box, k))) return { near, offset: side, box };
    }
  }
  return undefined;
}
