/** Routes for the `lanes` look: each wire kept clear of what the stages it
 *  passes draw and of the group boxes it neither leaves nor enters, each wire
 *  sharing a corridor on a track of its own, and each label set where it
 *  covers no stage. */
import { IDENTITY_POSE_COMPOSITION, pointAlongPath, type Path } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import type { MeasureRowText } from '../body';
import { SIDE_TRACK_GAP } from '../chainRoutes';
import { EDGE_DERIVE_PATH } from '../edge';
import {
  diagramScene, edgeIdOf, LABEL_PLACEMENT, type DataEdge, type DataGroup, type DataNode, type DiagramData, type DiagramRouter,
  type DiagramSceneOptions, type DiagramSpec, type EdgeStyle,
} from '../fromData';
import { nestGroups } from '../groupTree';
import { labelCenter } from '../label';
import { portSitesOf } from '../ports';

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
  /** The other places the port may sit, as `PortSpec.sites` gives them. */
  sites?: readonly { point: Vec2; normal: Vec2 | null }[];
}

/** Whether a port faces more up or down than sideways. */
const upright = (n: Vec2 | null): boolean => n !== null && Math.abs(n.y) > Math.abs(n.x);

/** Where a port sits facing a wire bound for height `y`: at the first of
 *  its places facing up toward it or down toward it, else where it is. */
const facingY = (end: LaneEnd, y: number): { point: Vec2; normal: Vec2 | null } =>
  [end, ...(end.sites ?? [])].find((s) => s.normal !== null && Math.sign(s.normal.y) === Math.sign(y - s.point.y) && upright(s.normal)) ?? end;

/** Between two wires sharing a corridor, and between a corridor's outer
 *  wires and the stages beside it: `chain`'s spacing for its side tracks. */
export const TRACK_GAP = SIDE_TRACK_GAP;

/** How far a wire keeps from anything a stage draws. */
const CLEAR = 3;

/** Whether a wire at `y`, or anywhere between `y` and `to`, comes within `CLEAR` of one of `boxes`. */
const covers = (boxes: readonly Box[], y: number, to = y): boolean =>
  boxes.some((b) => b.y - CLEAR < Math.max(y, to) && Math.min(y, to) < b.y + b.height + CLEAR);

/** A height a wire runs at through a column: its own, or a corridor along the lane edge numbered `edge`. */
type Level = number | { edge: number };

/** A wire's way from end to end: the height it runs at through each column it crosses, in order. */
export interface Course {
  from: LaneEnd;
  to: LaneEnd;
  legs: readonly { column: number; at: Level }[];
  /** It runs right to left, turning past each end. */
  back: boolean;
}

/** The lane `y` lies in, by its edges. */
const laneAt = (grid: LaneGrid, y: number): number => Math.max(0, grid.edges.filter((e) => e <= y).length - 1);

/** The lane edge nearest the lane of `near`, by lanes, along which a wire
 *  runs clear through every one of `columns`. Counted in lanes, not units,
 *  so the choice holds while the corridors widen to fit their tracks. */
function corridor(grid: LaneGrid, columns: readonly number[], near: number): number {
  const ink = columns.flatMap((c) => grid.ink[c] ?? []);
  const middle = laneAt(grid, near) + 0.5;
  const clear = grid.edges.flatMap((y, k) => (covers(ink, y) ? [] : [k]));
  return clear.reduce((best, k) => (Math.abs(k - middle) < Math.abs(best - middle) ? k : best), clear[0] ?? 0);
}

/** The columns from `a` to `b`, `a` and `b` included, in that order. */
const between = (a: number, b: number): number[] =>
  Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => a + Math.sign(b - a) * i);

/** How a wire from `from` to `to` runs past the stages between them, or
 *  undefined when its own route already clears them. Running forward it keeps
 *  its own height through each column where that is clear and takes a
 *  corridor through each stretch of columns where it is not; running back it
 *  takes one corridor clear of every column it spans, its own two included. */
export function laneCourse(grid: LaneGrid, from: LaneEnd, to: LaneEnd): Course | undefined {
  if (from.column >= to.column) {
    const columns = between(from.column, to.column);
    const edge = corridor(grid, columns, from.point.y);
    return { from, to, back: true, legs: columns.map((column) => ({ column, at: { edge } })) };
  }
  const columns = Array.from({ length: to.column - from.column - 1 }, (_, i) => from.column + 1 + i);
  const blocked = (c: number, y: number, until = y) => covers(grid.ink[c] ?? [], y, until);
  const first = columns.findIndex((c) => blocked(c, from.point.y, to.point.y));
  if (first < 0) return undefined;
  const want = columns.map((_, i) => (i < first ? from.point.y : to.point.y));
  const legs: { column: number; at: Level }[] = columns.map((column, i) => ({ column, at: want[i]! }));
  for (let i = 0; i < columns.length;) {
    let j = i;
    while (j < columns.length && blocked(columns[j]!, want[j]!)) j++;
    if (j === i) {
      i++;
      continue;
    }
    const edge = corridor(grid, columns.slice(i, j), want[i]!);
    for (let k = i; k < j; k++) legs[k] = { column: columns[k]!, at: { edge } };
    i = j;
  }
  return { from, to, back: false, legs };
}

/** A stretch of one course along one corridor: the columns it runs through, and the track it takes. */
interface Stretch {
  edge: number;
  lo: number;
  hi: number;
  track: number;
}

/** Each course's corridor stretches, each given a track: the first free on
 *  its corridor, where two stretches over or beside the same columns are
 *  never on the same one. Answers how many tracks each corridor holds. */
function assignTracks(courses: readonly (Course | undefined)[]): { stretches: Stretch[][]; tracks: Map<number, number> } {
  const stretches = courses.map((course) => {
    const out: Stretch[] = [];
    for (const { column, at } of course?.legs ?? []) {
      if (typeof at === 'number') continue;
      const last = out[out.length - 1];
      if (last !== undefined && last.edge === at.edge && Math.abs(column - (course!.back ? last.lo : last.hi)) === 1) {
        if (course!.back) last.lo = column;
        else last.hi = column;
      } else out.push({ edge: at.edge, lo: column, hi: column, track: 0 });
    }
    return out;
  });
  const ends = new Map<number, number[]>();
  for (const s of stretches.flat().sort((a, b) => a.lo - b.lo || a.hi - b.hi)) {
    const taken = ends.get(s.edge) ?? [];
    const free = taken.findIndex((end) => end + 1 < s.lo);
    s.track = free < 0 ? taken.length : free;
    taken[s.track] = s.hi;
    ends.set(s.edge, taken);
  }
  return { stretches, tracks: new Map([...ends].map(([edge, taken]) => [edge, taken.length])) };
}

/** The height of track `j` of `n` along lane edge `k`: spread about an inner
 *  edge, and inside the chart's top and bottom, the first half a gap in. */
function trackY(grid: LaneGrid, k: number, j: number, n: number): number {
  const last = grid.edges.length - 1;
  const y = grid.edges[k]!;
  if (k === 0) return y + (j + 0.5) * TRACK_GAP;
  if (k === last) return y - (j + 0.5) * TRACK_GAP;
  return y + (j - (n - 1) / 2) * TRACK_GAP;
}

/** Points in order, a point level with the two either side of it dropped. */
function straightened(points: readonly Vec2[]): Vec2[] {
  return points.filter((p, i) => {
    const a = points[i - 1];
    const b = points[i + 1];
    return a === undefined || b === undefined || !(a.y === p.y && p.y === b.y);
  });
}

/** The waypoints a course runs through, given the height of each column it
 *  crosses. Forward, a level run through each column and a change of height
 *  only in the gaps between; back, one run turning in the gap past each end. */
function waypointsOf(grid: LaneGrid, course: Course, ys: readonly number[]): Vec2[] {
  const { from, to } = course;
  const edge = (c: number, side: 0 | 1) => grid.columns[c]![side];
  if (course.back) return [{ x: edge(from.column, 1), y: ys[0]! }, { x: edge(to.column, 0), y: ys[0]! }];
  const points: Vec2[] = [];
  // A port short of its column's edge runs level out to it before turning,
  // past whatever else the column holds.
  const out = edge(from.column, 1);
  if (from.normal?.x === 1 && from.point.x < out - 1) points.push({ x: (from.point.x + out) / 2, y: from.point.y }, { x: out, y: from.point.y });
  // A port facing up or down turns onto its first height as far along as it
  // climbs, so the turn does not overshoot it; the last height, likewise.
  const first = ys[0]!;
  const leave = facingY(from, first);
  const rise = Math.abs(first - leave.point.y);
  if (upright(leave.normal) && leave.point.x + rise < out) points.push({ x: leave.point.x + rise, y: first }, { x: out, y: first });
  course.legs.forEach(({ column }, i) => points.push({ x: edge(column, 0), y: ys[i]! }, { x: edge(column, 1), y: ys[i]! }));
  const into = edge(to.column, 0);
  const last = ys[ys.length - 1]!;
  const arrive = facingY(to, last);
  const fall = Math.abs(last - arrive.point.y);
  if (upright(arrive.normal) && arrive.point.x - fall > into) points.push({ x: into, y: last }, { x: arrive.point.x - fall, y: last });
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

/** `diagramScene`'s specs for `data`, each pose where it draws rather than in the frame of the node above it, so
 *  a node and its rows can be read side by side. Every measurement the lanes look takes goes through this. */
export const worldSpecs = (data: DiagramData, options: Omit<DiagramSceneOptions, 'composition'>): DiagramSpec[] =>
  diagramScene(data, { ...options, composition: IDENTITY_POSE_COMPOSITION });

/** What a node draws, in specs from {@link worldSpecs}: its box, and each of its rows and marks, some of which sit outside it. */
export const inkOf = (id: string, specs: readonly DiagramSpec[]): Box[] =>
  specs.filter((s) => s.id === id || s.parent === id || String(s.id).startsWith(`${id}/mark:`)).map((s) => s.pose as Box);

/** What `routeWires` reads of the laid-out chart. */
export interface Laid {
  grid: Omit<LaneGrid, 'ink'>;
  column: ReadonlyMap<string, number>;
  router: DiagramRouter;
  measure: MeasureRowText | undefined;
  groups?: readonly DataGroup[];
}

/** A group's box as the scene draws it, the run of columns it stands over, and the stages it holds. */
interface Wall {
  box: Box;
  first: number;
  last: number;
  holds: ReadonlySet<string>;
}

/** `grid` as a wire sees it that runs past `walls`: each wall's box is ink
 *  in the columns it stands over, and those columns reach out past its
 *  sides, so the wire changes height clear of it. */
function walledIn(grid: LaneGrid, walls: readonly Wall[]): LaneGrid {
  if (walls.length === 0) return grid;
  const over = (c: number) => walls.filter((w) => w.first <= c && c <= w.last);
  return {
    edges: grid.edges,
    ink: grid.ink.map((boxes, c) => boxes.concat(over(c).map((w) => w.box))),
    columns: grid.columns.map(([lo, hi], c) => over(c).reduce<readonly [number, number]>(([l, h], { box, first, last }) => [
      c === first ? Math.min(l, box.x - CLEAR) : l,
      c === last ? Math.max(h, box.x + box.width + CLEAR) : h,
    ], [lo, hi])),
  };
}

/** Each wire's edge, given the waypoints that keep it clear of the stages it
 *  passes and, when it is labeled, a place for its label that covers none;
 *  and how many tracks each lane edge's corridor needs. */
export function routeWires(
  wires: readonly { edge: DataEdge; style: EdgeStyle }[], nodes: readonly DataNode[], laid: Laid,
): { edges: { edge: DataEdge; style: EdgeStyle }[]; tracks: ReadonlyMap<number, number> } {
  const specs = worldSpecs({ nodes, edges: wires.map((w) => w.edge), ...(laid.groups !== undefined ? { groups: laid.groups } : {}) }, {
    layout: 'none', router: laid.router, ...(laid.measure !== undefined ? { measure: laid.measure } : {}),
  });
  const spec = new Map(specs.map((s) => [s.id as string, s]));
  const ink = new Map(nodes.map((n) => [n.id, inkOf(n.id, specs)]));
  const grid: LaneGrid = { ...laid.grid, ink: laid.grid.columns.map((_, c) => [...ink].flatMap(([id, b]) => (laid.column.get(id) === c ? b : []))) };
  const end = (stage: string, port: string): LaneEnd => {
    const s = spec.get(stage)!;
    const [site, ...sites] = portSitesOf({ id: stage, data: s.data } as never, s.pose, port);
    return { column: laid.column.get(stage)!, point: site?.point ?? { x: 0, y: 0 }, normal: site?.normal ?? null, sites };
  };
  const walls = nestGroups(laid.groups ?? [], (id) => ink.has(id)).flatMap((g): Wall[] => {
    const box = spec.get(g.id)?.pose as Box | undefined;
    const at = g.members.flatMap((m) => (laid.column.has(m) ? [laid.column.get(m)!] : []));
    return box === undefined || at.length === 0 ? [] : [{ box, first: Math.min(...at), last: Math.max(...at), holds: new Set(g.members) }];
  });
  const grids = wires.map(({ edge }) => walledIn(grid, walls.filter((w) => !w.holds.has(edge.from) && !w.holds.has(edge.to))));
  const courses = wires.map(({ edge }, w) => (edge.from === edge.to ? undefined : laneCourse(grids[w]!, end(edge.from, edge.fromPort!), end(edge.to, edge.toPort!))));
  const { stretches, tracks } = assignTracks(courses);
  // Outside the lanes is off the chart: a label goes no further than its wires.
  const [top, bottom] = [grid.edges[0] ?? 0, grid.edges[grid.edges.length - 1] ?? 0];
  const keepOut = [...ink.values()].flat()
    .concat({ x: -1e9, y: top - 1e9, width: 2e9, height: 1e9 }, { x: -1e9, y: bottom, width: 2e9, height: 1e9 });
  const routes = wires.map(({ edge }, w) => {
    const course = courses[w];
    const ys = course?.legs.map(({ column, at }) => {
      if (typeof at === 'number') return at;
      const s = stretches[w]!.find((t) => t.edge === at.edge && t.lo <= column && column <= t.hi)!;
      return trackY(grid, at.edge, s.track, tracks.get(at.edge)!);
    });
    const waypoints = course === undefined ? undefined : waypointsOf(grids[w]!, course, ys!);
    return { waypoints, path: routeOf(spec.get(edge.from)!, edge.fromPort!, spec.get(edge.to)!, edge.toPort!, laid.router, waypoints) };
  });
  // Each wire, as the boxes of its drawn segments, for the labels of the others to keep off.
  const segments = routes.map(({ path }) => {
    const c = path?.kind === 'polygon' ? path.coords : [];
    return Array.from({ length: Math.max(0, c.length / 2 - 1) }, (_, i): Box => {
      const [x0, y0, x1, y1] = [c[2 * i]!, c[2 * i + 1]!, c[2 * i + 2]!, c[2 * i + 3]!];
      return { x: Math.min(x0, x1) - 1, y: Math.min(y0, y1) - 1, width: Math.abs(x1 - x0) + 2, height: Math.abs(y1 - y0) + 2 };
    });
  });
  const edges = wires.map(({ edge, style }, w) => {
    const { waypoints, path } = routes[w]!;
    const routed: DataEdge = waypoints === undefined ? edge : { ...edge, routed: waypoints };
    const label = spec.get(`${edgeIdOf(edge)}/label`)?.pose as Box | undefined;
    // Off the other wires too where there is room for that, else off the stages alone.
    const others = keepOut.concat(segments.flatMap((boxes, k) => (k === w ? [] : boxes)));
    const offset = LABEL_PLACEMENT.offset ?? 0;
    const clear = path === null || label === undefined
      ? undefined
      : clearLabel(path, label, offset, others) ?? clearLabel(path, label, offset, keepOut);
    if (clear === undefined) return { edge: routed, style };
    keepOut.push(clear.box);
    return { edge: { ...routed, labelPlacement: { at: { near: clear.near }, offset: clear.offset } }, style };
  });
  return { edges, tracks };
}
