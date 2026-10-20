/**
 * Waypoint editing as pure math on an edge's route.
 *
 * The **stops** are the points a route must pass through: its `from` end, the
 * author's waypoints, and its `to` end. The **drawn** route is what the router
 * made of them. Every shipped router passes through each stop exactly, so the
 * drawn polyline splits at the stops and a leg's middle is found on it.
 *
 * Each edit answers the edge's new waypoints, never the whole route.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { avoid, orthogonal, type Router } from './edge';
import { simplifyStops } from './polyline';

export { simplifyStops };

/** A handle a selected edge shows along its route. `at` is where it sits, in world units. */
export type RouteHandle =
  /** Waypoint `index`: dragging moves it. */
  | { kind: 'vertex'; index: number; at: Vec2 }
  /** The middle of leg `leg`, between stops `leg` and `leg + 1`: dragging inserts a waypoint there. */
  | { kind: 'insert'; leg: number; at: Vec2 }
  /** Segment `index` of an orthogonal route, which runs along `axis`: dragging slides it across. */
  | { kind: 'segment'; index: number; axis: 'x' | 'y'; at: Vec2 };

const EPS = 1e-6;
/** World units a jog stands off from the port it keeps square. */
const JOG = 16;

const same = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;

/** The axis a segment runs along, or null when it is a point or slanted. */
export function segmentAxis(a: Vec2, b: Vec2): 'x' | 'y' | null {
  if (same(a, b)) return null;
  if (Math.abs(a.y - b.y) <= EPS) return 'x';
  if (Math.abs(a.x - b.x) <= EPS) return 'y';
  return null;
}

/** Index in `drawn` of each stop, found in order; null when one is not on it. */
function stopIndices(drawn: readonly Vec2[], stops: readonly Vec2[]): number[] | null {
  const out: number[] = [];
  let from = 0;
  for (const stop of stops) {
    let i = from;
    while (i < drawn.length && !same(drawn[i]!, stop)) i++;
    if (i === drawn.length) return null;
    out.push(i);
    from = i;
  }
  return out;
}

/** The point halfway along `drawn` between indices `a` and `b`, by length. */
function middleOf(drawn: readonly Vec2[], a: number, b: number): Vec2 {
  let total = 0;
  for (let i = a; i < b; i++) total += Math.hypot(drawn[i + 1]!.x - drawn[i]!.x, drawn[i + 1]!.y - drawn[i]!.y);
  let left = total / 2;
  for (let i = a; i < b; i++) {
    const p = drawn[i]!;
    const q = drawn[i + 1]!;
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len >= left && len > 0) return { x: p.x + ((q.x - p.x) * left) / len, y: p.y + ((q.y - p.y) * left) / len };
    left -= len;
  }
  return drawn[a]!;
}

/** The handles an edge shows: a bar per segment under `orthogonal` and
 *  `avoid`, else a dot per waypoint and a hollow dot per leg. */
export function routeHandles(drawn: readonly Vec2[], stops: readonly Vec2[], router: Router): RouteHandle[] {
  if (router === orthogonal || router === avoid) {
    const out: RouteHandle[] = [];
    for (let i = 0; i + 1 < drawn.length; i++) {
      const a = drawn[i]!;
      const b = drawn[i + 1]!;
      const axis = segmentAxis(a, b);
      if (axis !== null) out.push({ kind: 'segment', index: i, axis, at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
    }
    return out;
  }
  const out: RouteHandle[] = [];
  for (let k = 1; k + 1 < stops.length; k++) out.push({ kind: 'vertex', index: k - 1, at: stops[k]! });
  const at = stopIndices(drawn, stops);
  for (let leg = 0; leg + 1 < stops.length; leg++) {
    const a = stops[leg]!;
    const b = stops[leg + 1]!;
    out.push({
      kind: 'insert', leg,
      at: at === null ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : middleOf(drawn, at[leg]!, at[leg + 1]!),
    });
  }
  return out;
}

const interior = (stops: readonly Vec2[]): Vec2[] => stops.slice(1, -1).map((p) => ({ x: p.x, y: p.y }));

/** The waypoints with waypoint `index` moved to `to`. */
export function dragVertex(stops: readonly Vec2[], index: number, to: Vec2): Vec2[] {
  const out = interior(stops);
  out[index] = { x: to.x, y: to.y };
  return out;
}

/** The waypoints with one at `at` inserted on leg `leg`: it becomes waypoint `leg`. */
export function insertWaypoint(stops: readonly Vec2[], leg: number, at: Vec2): Vec2[] {
  const out = interior(stops);
  out.splice(leg, 0, { x: at.x, y: at.y });
  return out;
}

/** The waypoints without waypoint `index`. */
export function removeWaypoint(stops: readonly Vec2[], index: number): Vec2[] {
  const out = interior(stops);
  out.splice(index, 1);
  return out;
}

const shifted = (p: Vec2, axis: 'x' | 'y', offset: number): Vec2 =>
  axis === 'x' ? { x: p.x, y: p.y + offset } : { x: p.x + offset, y: p.y };

/** The point `distance` from `a` toward `b`. */
function toward(a: Vec2, b: Vec2, distance: number): Vec2 {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return len === 0 ? a : { x: a.x + ((b.x - a.x) * distance) / len, y: a.y + ((b.y - a.y) * distance) / len };
}

/**
 * The waypoints of `drawn`, an orthogonal route, with segment `index` slid
 * `offset` across its axis: every interior bend of the new route, since the
 * orthogonal router recomputes elbows between stops. A segment touching a
 * port keeps a short stub there and jogs over, so the port end stays square.
 */
export function dragSegment(drawn: readonly Vec2[], index: number, offset: number): Vec2[] {
  const a = drawn[index]!;
  const b = drawn[index + 1]!;
  const axis = segmentAxis(a, b);
  if (axis === null) return interior(drawn);
  const jog = Math.min(JOG, Math.hypot(b.x - a.x, b.y - a.y) / 2);
  const start = index === 0 ? toward(a, b, jog) : null;
  const end = index === drawn.length - 2 ? toward(b, a, jog) : null;
  const route = [
    ...drawn.slice(0, index),
    ...(start === null ? [] : [a, start]),
    shifted(start ?? a, axis, offset),
    shifted(end ?? b, axis, offset),
    ...(end === null ? [] : [end, b]),
    ...drawn.slice(index + 2),
  ];
  return interior(simplifyStops(route));
}

/**
 * The waypoints of an `avoid` route with segment `index` of `drawn` slid
 * `offset` across its axis and pinned there: its two ends join the author's
 * waypoints, in route order, and the router keeps the rest. A waypoint at one
 * of its ends moves with it, and a segment meeting a port jogs off it so the
 * port end stays square.
 */
export function pinSegment(drawn: readonly Vec2[], stops: readonly Vec2[], index: number, offset: number): Vec2[] {
  const a = drawn[index]!;
  const b = drawn[index + 1]!;
  const axis = segmentAxis(a, b);
  const waypoints = interior(stops);
  if (axis === null) return waypoints;
  const jog = Math.min(JOG, Math.hypot(b.x - a.x, b.y - a.y) / 2);
  const start = index === 0 ? toward(a, b, jog) : a;
  const end = index === drawn.length - 2 ? toward(b, a, jog) : b;
  const at = waypoints.map((w) => drawn.findIndex((p) => same(p, w)));
  const before = waypoints.filter((w, k) => at[k]! >= 0 && at[k]! <= index && !same(w, a));
  const after = waypoints.filter((w, k) => (at[k]! < 0 || at[k]! > index) && !same(w, b));
  return [...before, shifted(start, axis, offset), shifted(end, axis, offset), ...after];
}

/** The waypoints of an `avoid` route without those at either end of segment
 *  `index`, which hands the segment back to the router; null when neither end is one. */
export function unpinSegment(drawn: readonly Vec2[], stops: readonly Vec2[], index: number): Vec2[] | null {
  const ends = [drawn[index]!, drawn[index + 1]!];
  const waypoints = interior(stops);
  const kept = waypoints.filter((w) => !ends.some((e) => same(e, w)));
  return kept.length === waypoints.length ? null : kept;
}

/**
 * The waypoints with segment `index` straightened away: its neighbors run in
 * parallel, and the one touching no port slides onto the other's line. Null
 * when it is the first or last segment, or both neighbors touch a port.
 */
export function removeSegment(drawn: readonly Vec2[], index: number): Vec2[] | null {
  const last = drawn.length - 2;
  if (index <= 0 || index >= last) return null;
  const axis = segmentAxis(drawn[index]!, drawn[index + 1]!);
  if (axis === null) return null;
  const across = (p: Vec2) => (axis === 'x' ? p.x : p.y);
  const prev = index - 1;
  const next = index + 1;
  if (next < last) return dragSegment(drawn, next, across(drawn[index]!) - across(drawn[index + 1]!));
  if (prev > 0) return dragSegment(drawn, prev, across(drawn[index + 1]!) - across(drawn[index]!));
  return null;
}
