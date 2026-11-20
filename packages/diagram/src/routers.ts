/**
 * The routers an edge is drawn with: functions from two resolved ends and the
 * waypoints between them to the points the edge runs through. `edge` resolves
 * the ends and calls one by the key the edge names.
 *
 * A router is generic over its point type `P`, a plane `Vec2` by default.
 * `straight` takes any; `bezier` is `bezierFor` over `Vec2`, and runs in any
 * dimension given the point's components. `orthogonal` and `avoid` are
 * axis-aligned in a plane, so they are `Vec2` only.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { PORT_REACH, distance, dot, portCurvePoints } from '@weasel-js/geom/nd';
import { routeHolds } from './avoid/holds';
import type { Port } from './types';

/** What a router is given: the two resolved ends, the author's waypoints
 *  between them, and the route stored on the edge, when it holds one. */
export interface RouteRequest<P = Vec2> {
  from: Port<P>;
  to: Port<P>;
  waypoints: readonly P[];
  route?: readonly P[] | undefined;
}

/** A router returns the points the edge runs through, `from.point` first and
 *  `to.point` last. */
export type Router<P = Vec2> = (req: RouteRequest<P>) => readonly P[];

/** The straight run between the two ends, through any waypoints, in any dimension. */
export const straight = <P = Vec2>(req: RouteRequest<P>): readonly P[] => [req.from.point, ...req.waypoints, req.to.point];

/**
 * An axis-aligned route: leave along the departing end's normal and arrive
 * against the receiving one's.
 *
 * A leg is one elbow where the two ends face different axes and two where they
 * face the same one, turning at the midpoint of the axis they share. Arriving
 * along the port's own facing is what makes the arrowhead point *into* the
 * shape.
 */
export const orthogonal: Router = (req) => {
  const stops = [req.from.point, ...req.waypoints, req.to.point];
  const out: Vec2[] = [stops[0]!];
  for (let i = 1; i < stops.length; i++) {
    const a = out[out.length - 1]!;
    const b = stops[i]!;
    if (a.x === b.x || a.y === b.y) {
      out.push(b);
      continue;
    }
    // Only the first leg has a port to leave along; later legs follow the
    // one before them so the route does not alternate for no reason.
    const leaveHorizontal = i === 1
      ? isHorizontal(req.from.normal)
      : out.length > 1 && out[out.length - 2]!.y === a.y;
    // Likewise only the last leg has a port to arrive against. Without a
    // facing there is nothing to satisfy, so it keeps the single elbow.
    const arriving = i === stops.length - 1 ? req.to.normal : null;
    const arriveHorizontal = arriving == null ? !leaveHorizontal : isHorizontal(arriving);
    if (leaveHorizontal !== arriveHorizontal) {
      out.push(leaveHorizontal ? { x: b.x, y: a.y } : { x: a.x, y: b.y });
      out.push(b);
      continue;
    }
    // Splitting the leg at its midpoint starts back the way the route just
    // came when the last stop overshot this one; turning at once does not.
    const prev = out.length > 1 ? out[out.length - 2]! : null;
    if (leaveHorizontal) {
      const mid = midway(a.x, b.x);
      if (prev !== null && (mid - a.x) * (a.x - prev.x) < 0) out.push({ x: a.x, y: b.y }, b);
      else out.push({ x: mid, y: a.y }, { x: mid, y: b.y }, b);
    } else {
      const mid = midway(a.y, b.y);
      if (prev !== null && (mid - a.y) * (a.y - prev.y) < 0) out.push({ x: b.x, y: a.y }, b);
      else out.push({ x: a.x, y: mid }, { x: b.x, y: mid }, b);
    }
  }
  return out;
};

/** Halfway from `a` to `b`, finite wherever both are. */
function midway(a: number, b: number): number {
  const m = (a + b) / 2;
  return Number.isFinite(m) ? m : a / 2 + b / 2;
}

/** `b - a`, component-wise. */
const minus = (b: readonly number[], a: readonly number[]): number[] => b.map((v, i) => v - a[i]!);

/** The unit vector from `a` to `b`, or null where they coincide; finite wherever both are. */
function direction(a: readonly number[], b: readonly number[]): number[] | null {
  let d = minus(b, a);
  let len = distance(a, b);
  if (!Number.isFinite(len)) {
    const [qa, qb] = [a.map((v) => v / 4), b.map((v) => v / 4)];
    d = minus(qb, qa);
    len = distance(qa, qb);
  }
  return len === 0 ? null : d.map((v) => v / len);
}

/** Which axis a port faces. A port with no facing counts as horizontal. */
function isHorizontal(normal: Vec2 | null | undefined): boolean {
  return Math.abs(normal?.x ?? 1) >= Math.abs(normal?.y ?? 0);
}

/** How a router reads a point as numbers, and writes numbers back as one. */
export interface PointComponents<P> {
  of(point: P): readonly number[];
  point(components: readonly number[]): P;
}

/** A plane point's components, `[x, y]`. */
export const VEC2_COMPONENTS: PointComponents<Vec2> = {
  of: (p) => [p.x, p.y],
  point: ([x, y]) => ({ x: x!, y: y! }),
};

/**
 * A smooth route over points of any dimension, sampled into points.
 *
 * Each leg is a cubic that leaves along the departing end's normal and arrives
 * against the receiving one's, and passes each waypoint without a corner.
 * Sampled rather than emitted as curve commands so every router returns the
 * same thing.
 */
export function bezierFor<P>(components: PointComponents<P>): Router<P> {
  return (req) => {
    const stops = [req.from.point, ...req.waypoints, req.to.point].map((p) => components.of(p));
    const out: P[] = [req.from.point];
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1]!;
      const b = stops[i]!;
      const outN = i === 1 ? componentsOf(components, req.from.normal) : through(stops, i - 1);
      const inN = i === stops.length - 1 ? componentsOf(components, req.to.normal) : negated(through(stops, i));
      const leg = portCurvePoints(a, b, outN, inN, BEZIER_SAMPLES, legReach(a, b, outN, inN));
      for (const p of leg) out.push(components.point(p));
    }
    return out;
  };
}

const componentsOf = <P>(components: PointComponents<P>, p: P | null): readonly number[] | null =>
  (p == null ? null : components.of(p));

/** {@link bezierFor} on the plane. */
export const bezier: Router = bezierFor(VEC2_COMPONENTS);

const BEZIER_SAMPLES = 16;

/**
 * How far a leg's control points reach, as `portCurvePoints` reads it. Where
 * the leg leaves and arrives along one axis, facing on, the reach goes no
 * further along that axis than the leg travels, so the curve stays between
 * its two ends there rather than swinging past them into whatever sits beside
 * either: a long leg between two near ranks otherwise sweeps through the rank
 * it left.
 */
function legReach(
  a: readonly number[], b: readonly number[], outN: readonly number[] | null, inN: readonly number[] | null,
): number {
  if (outN === null || inN === null || dot(outN, inN) > -0.999) return PORT_REACH;
  const chord = distance(a, b);
  if (chord === 0) return PORT_REACH;
  let along = dot(minus(b, a), outN) / chord;
  if (!Number.isFinite(along)) {
    const d = direction(a, b);
    along = d === null ? 0 : dot(d, outN);
  }
  return along > 0 ? Math.min(PORT_REACH, along) : PORT_REACH;
}

/**
 * The direction a smooth route passes an interior stop: along the straight run
 * it makes with a neighboring waypoint that differs from it along one axis
 * only, else from the stop before it toward the one after. Two such waypoints
 * are a run the route was meant to hold, the way `layered` lays one through
 * each rank.
 */
function through(stops: readonly (readonly number[])[], i: number): number[] | null {
  const last = stops.length - 1;
  const run = (a: number, b: number) => a >= 1 && b <= last - 1 && alongOneAxis(stops[a]!, stops[b]!);
  const [from, to] = run(i, i + 1) ? [i, i + 1] : run(i - 1, i) ? [i - 1, i] : [i - 1, i + 1];
  return direction(stops[from]!, stops[to]!);
}

/** Whether `a` and `b` differ in at most one component. */
function alongOneAxis(a: readonly number[], b: readonly number[]): boolean {
  let differ = 0;
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k] && ++differ > 1) return false;
  return true;
}

const negated = (v: number[] | null): number[] | null => (v === null ? null : v.map((c) => -c));

/**
 * The route the obstacle-avoiding router stored on the edge, while it still
 * fits the ends and passes every waypoint; else `orthogonal` through the stops,
 * so an end moved by something that did not reroute still draws sensibly.
 * The route itself is computed at edit time (`useAvoidRouting`).
 */
export const avoid: Router = (req) =>
  (req.route !== undefined && routeHolds(req.from, req.to, req.waypoints, req.route)
    ? [req.from.point, ...req.route, req.to.point]
    : orthogonal(req));

/** The routers this package ships. A consumer's own go in the same shape. */
export const ROUTERS: Readonly<Record<string, Router>> = Object.freeze({
  straight: straight as Router,
  orthogonal,
  bezier,
  avoid,
});
