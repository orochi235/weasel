/**
 * Nudging: collinear, overlapping runs of different connectors in one channel
 * form a bundle, and are spread apart about the channel's middle, ordered by
 * where each comes from and goes so they do not cross. A run meeting a port or
 * an authored waypoint stays put; the runs beside it stretch instead.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { simplifyStops } from '../polyline';
import type { ObstacleIndex } from './obstacles';

/** One connector's route to nudge: its whole polyline, ports included, and
 *  the waypoints it must keep. */
export interface NudgeRoute {
  points: Vec2[];
  waypoints: readonly Vec2[];
}

/** One run that may move: segment `i` of route `edge`, on line `c` from `lo` to `hi`. */
interface Run {
  edge: string;
  i: number;
  c: number;
  lo: number;
  hi: number;
  /** Which side of the line the route comes from at `lo` and goes to at `hi`: -1, 0, or 1. */
  sideLo: number;
  sideHi: number;
}

const EPS = 1e-6;
type Axis = 'h' | 'v';

const along = (p: Vec2, axis: Axis) => (axis === 'h' ? p.x : p.y);
const across = (p: Vec2, axis: Axis) => (axis === 'h' ? p.y : p.x);
const sideOf = (v: number) => (v > EPS ? 1 : v < -EPS ? -1 : 0);
const isWaypoint = (p: Vec2, waypoints: readonly Vec2[]) =>
  waypoints.some((w) => Math.abs(w.x - p.x) < EPS && Math.abs(w.y - p.y) < EPS);

/** The runs of `routes` along `axis` that may move. */
function runsOf(routes: ReadonlyMap<string, NudgeRoute>, axis: Axis): Run[] {
  const out: Run[] = [];
  for (const [edge, { points, waypoints }] of routes) {
    for (let i = 1; i + 2 < points.length; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      if (Math.abs(across(a, axis) - across(b, axis)) > EPS || Math.abs(along(a, axis) - along(b, axis)) < EPS) continue;
      if (isWaypoint(a, waypoints) || isWaypoint(b, waypoints)) continue;
      const c = across(a, axis);
      const forward = along(a, axis) < along(b, axis);
      const [loEnd, loNext, hiEnd, hiNext] = forward ? [a, points[i - 1]!, b, points[i + 2]!] : [b, points[i + 2]!, a, points[i - 1]!];
      out.push({
        edge, i, c, lo: along(loEnd, axis), hi: along(hiEnd, axis),
        sideLo: sideOf(across(loNext, axis) - c), sideHi: sideOf(across(hiNext, axis) - c),
      });
    }
  }
  return out;
}

/** The runs sharing a line with an overlap, grouped, where more than one connector shares. */
function bundlesOf(runs: Run[]): Run[][] {
  runs.sort((s, t) => s.c - t.c || s.lo - t.lo);
  const out: Run[][] = [];
  let current: Run[] = [];
  let reach = -Infinity;
  const flush = () => {
    if (new Set(current.map((r) => r.edge)).size > 1) out.push(current);
    current = [];
  };
  for (const run of runs) {
    const joins = current.length > 0 && Math.abs(run.c - current[0]!.c) < EPS && run.lo < reach - EPS;
    if (!joins) {
      flush();
      reach = -Infinity;
    }
    current.push(run);
    reach = Math.max(reach, run.hi);
  }
  flush();
  return out;
}

/** Negative when `s` should sit on the low side of `t`. A run's neighbor
 *  coming from one side puts it nearer that side; of two from the same side,
 *  the one turning further out goes further from it. */
function order(s: Run, t: Run): number {
  if (s.sideLo !== 0 && t.sideLo !== 0 && (s.sideLo !== t.sideLo || Math.abs(s.lo - t.lo) > EPS)) {
    if (s.sideLo !== t.sideLo) return s.sideLo - t.sideLo;
    return (s.lo < t.lo ? 1 : -1) * -s.sideLo;
  }
  if (s.sideHi !== 0 && t.sideHi !== 0 && (s.sideHi !== t.sideHi || Math.abs(s.hi - t.hi) > EPS)) {
    if (s.sideHi !== t.sideHi) return s.sideHi - t.sideHi;
    return (s.hi > t.hi ? 1 : -1) * -s.sideHi;
  }
  return s.edge < t.edge ? -1 : s.edge > t.edge ? 1 : s.i - t.i;
}

/** The free span across a bundle's line at `c`, between the nearest
 *  obstacles on either side over `lo` to `hi`. */
function freeSpan(obstacles: ObstacleIndex, axis: Axis, c: number, lo: number, hi: number, reach: number): [number, number] {
  const probe = axis === 'h'
    ? { x: lo, y: c - reach, width: hi - lo, height: 2 * reach }
    : { x: c - reach, y: lo, width: 2 * reach, height: hi - lo };
  let low = c - reach;
  let high = c + reach;
  for (const { obstacle } of obstacles.near(probe)) {
    const b = obstacle.box;
    const [bLo, bHi, bAcross, bSize] = axis === 'h' ? [b.x, b.x + b.width, b.y, b.height] : [b.y, b.y + b.height, b.x, b.width];
    if (bHi <= lo + EPS || bLo >= hi - EPS) continue;
    if (bAcross + bSize <= c + EPS) low = Math.max(low, bAcross + bSize);
    else if (bAcross >= c - EPS) high = Math.min(high, bAcross);
  }
  return [low + 1, high - 1];
}

/** Where each run of `bundle`, already ordered, goes across its line. */
function spread(bundle: readonly Run[], spacing: number, span: [number, number]): number[] {
  const n = bundle.length;
  const c = bundle[0]!.c;
  const room = span[1] - span[0];
  if (room <= 0) return bundle.map(() => c);
  const step = Math.min(spacing, room / (n - 1));
  let at = bundle.map((_, k) => c + (k - (n - 1) / 2) * step);
  const shift = at[0]! < span[0] ? span[0] - at[0]! : at[n - 1]! > span[1] ? span[1] - at[n - 1]! : 0;
  if (shift !== 0) at = at.map((v) => v + shift);
  return at;
}

function nudgeAxis(routes: Map<string, NudgeRoute>, axis: Axis, spacing: number, obstacles: ObstacleIndex): void {
  for (const bundle of bundlesOf(runsOf(routes, axis))) {
    bundle.sort(order);
    const lo = Math.min(...bundle.map((r) => r.lo));
    const hi = Math.max(...bundle.map((r) => r.hi));
    const span = freeSpan(obstacles, axis, bundle[0]!.c, lo, hi, spacing * bundle.length);
    spread(bundle, spacing, span).forEach((value, k) => {
      const run = bundle[k]!;
      const points = routes.get(run.edge)!.points;
      for (const j of [run.i, run.i + 1]) {
        points[j] = axis === 'h' ? { x: points[j]!.x, y: value } : { x: value, y: points[j]!.y };
      }
    });
  }
}

/** `points` simplified between its waypoints, each of which it keeps. */
function simplifyKeeping(points: readonly Vec2[], waypoints: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  let start = 0;
  for (let k = 1; k < points.length; k++) {
    if (k !== points.length - 1 && !isWaypoint(points[k]!, waypoints)) continue;
    const piece = simplifyStops(points.slice(start, k + 1));
    out.push(...(out.length === 0 ? piece : piece.slice(1)));
    start = k;
  }
  return out;
}

/** `routes` with their bundles spread `spacing` apart, never into an obstacle. */
export function nudge(
  routes: ReadonlyMap<string, NudgeRoute>,
  spacing: number,
  obstacles: ObstacleIndex,
): Map<string, Vec2[]> {
  const work = new Map([...routes].map(([id, r]) => [id, { points: [...r.points], waypoints: r.waypoints }]));
  nudgeAxis(work, 'h', spacing, obstacles);
  nudgeAxis(work, 'v', spacing, obstacles);
  return new Map([...work].map(([id, r]) => [id, simplifyKeeping(r.points, r.waypoints)]));
}
