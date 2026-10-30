/**
 * The routers an edge is drawn with: functions from two resolved ends and the
 * waypoints between them to the points the edge runs through. `edge` resolves
 * the ends and calls one by the key the edge names.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { PORT_REACH, portCurvePoints } from '@weasel-js/geom';
import { routeHolds } from './avoid/holds';
import type { Port } from './types';

/** What a router is given: the two resolved ends, the author's waypoints
 *  between them, and the route stored on the edge, when it holds one. */
export interface RouteRequest {
  from: Port;
  to: Port;
  waypoints: readonly Vec2[];
  route?: readonly Vec2[] | undefined;
}

/** A router returns the points the edge runs through, `from.point` first and
 *  `to.point` last. */
export type Router = (req: RouteRequest) => readonly Vec2[];

/** The straight run between the two ends, through any waypoints. */
export const straight: Router = (req) => [req.from.point, ...req.waypoints, req.to.point];

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
      const mid = (a.x + b.x) / 2;
      if (prev !== null && (mid - a.x) * (a.x - prev.x) < 0) out.push({ x: a.x, y: b.y }, b);
      else out.push({ x: mid, y: a.y }, { x: mid, y: b.y }, b);
    } else {
      const mid = (a.y + b.y) / 2;
      if (prev !== null && (mid - a.y) * (a.y - prev.y) < 0) out.push({ x: b.x, y: a.y }, b);
      else out.push({ x: a.x, y: mid }, { x: b.x, y: mid }, b);
    }
  }
  return out;
};

/** Which axis a port faces. A port with no facing counts as horizontal. */
function isHorizontal(normal: Vec2 | null | undefined): boolean {
  return Math.abs(normal?.x ?? 1) >= Math.abs(normal?.y ?? 0);
}

/**
 * A smooth route, sampled into points.
 *
 * Each leg is a cubic that leaves along the departing end's normal and arrives
 * against the receiving one's, and passes each waypoint without a corner.
 * Sampled rather than emitted as curve commands so every router returns the
 * same thing.
 */
export const bezier: Router = (req) => {
  const stops = [req.from.point, ...req.waypoints, req.to.point];
  const out: Vec2[] = [stops[0]!];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    const outN = i === 1 ? req.from.normal : through(stops, i - 1);
    const inN = i === stops.length - 1 ? req.to.normal : negated(through(stops, i));
    const leg = portCurvePoints(
      a.x, a.y, b.x, b.y,
      outN == null ? null : [outN.x, outN.y],
      inN == null ? null : [inN.x, inN.y],
      BEZIER_SAMPLES,
      legReach(a, b, outN, inN),
    );
    for (const [x, y] of leg) out.push({ x, y });
  }
  return out;
};

const BEZIER_SAMPLES = 16;

/**
 * How far a leg's control points reach, as `portCurvePoints` reads it. Where
 * the leg leaves and arrives along one axis, facing on, the reach goes no
 * further along that axis than the leg travels, so the curve stays between
 * its two ends there rather than swinging past them into whatever sits beside
 * either: a long leg between two near ranks otherwise sweeps through the rank
 * it left.
 */
function legReach(a: Vec2, b: Vec2, outN: Vec2 | null | undefined, inN: Vec2 | null | undefined): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (outN == null || inN == null || chord === 0 || outN.x * inN.x + outN.y * inN.y > -0.999) return PORT_REACH;
  const along = dx * outN.x + dy * outN.y;
  return along > 0 ? Math.min(PORT_REACH, along / chord) : PORT_REACH;
}

/**
 * The direction a smooth route passes an interior stop: along the straight run
 * it makes with a neighboring waypoint level with it on one axis, else from
 * the stop before it toward the one after. Two such waypoints are a run the
 * route was meant to hold, the way `layered` lays one through each rank.
 */
function through(stops: readonly Vec2[], i: number): Vec2 | null {
  const last = stops.length - 1;
  const run = (a: number, b: number) => a >= 1 && b <= last - 1 && (stops[a]!.x === stops[b]!.x || stops[a]!.y === stops[b]!.y);
  const [from, to] = run(i, i + 1) ? [i, i + 1] : run(i - 1, i) ? [i - 1, i] : [i - 1, i + 1];
  const dx = stops[to]!.x - stops[from]!.x;
  const dy = stops[to]!.y - stops[from]!.y;
  const len = Math.hypot(dx, dy);
  return len === 0 ? null : { x: dx / len, y: dy / len };
}

const negated = (v: Vec2 | null): Vec2 | null => (v === null ? null : { x: -v.x, y: -v.y });

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
  straight,
  orthogonal,
  bezier,
  avoid,
});
