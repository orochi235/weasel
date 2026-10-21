/**
 * Whether a stored route still fits its ends: it leaves along the departing
 * port's facing, arrives against the receiving one's, and passes every
 * authored waypoint in order. One that does not was made for ends that have
 * since moved.
 */
import type { Vec2 } from '@weasel-js/core/math';

/** An end as the check reads it: where it is and which way it faces. */
export interface HeldEnd {
  point: Vec2;
  normal: Vec2 | null;
}

const EPS = 1e-6;

/** Whether `d` runs along `normal`, the same way when `sign` is 1 and against it when -1. */
function runsAlong(d: Vec2, normal: Vec2, sign: 1 | -1): boolean {
  const len = Math.hypot(d.x, d.y) * Math.hypot(normal.x, normal.y);
  if (len === 0) return false;
  const cross = d.x * normal.y - d.y * normal.x;
  return Math.abs(cross) <= EPS * len && sign * (d.x * normal.x + d.y * normal.y) > 0;
}

/** How far along the segment from `a` to `b` point `p` lies, 0 to 1, or
 *  null when it is not on it. */
function onSegment(p: Vec2, a: Vec2, b: Vec2): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y) <= EPS * Math.max(1, Math.sqrt(len2)) ? t : null;
}

/** Whether `route`, the bends between `from` and `to`, still fits them and passes `waypoints` in order. */
export function routeHolds(from: HeldEnd, to: HeldEnd, waypoints: readonly Vec2[], route: readonly Vec2[]): boolean {
  const points = [from.point, ...route, to.point];
  const n = points.length;
  const first = { x: points[1]!.x - points[0]!.x, y: points[1]!.y - points[0]!.y };
  const last = { x: points[n - 1]!.x - points[n - 2]!.x, y: points[n - 1]!.y - points[n - 2]!.y };
  if (from.normal !== null && !runsAlong(first, from.normal, 1)) return false;
  if (to.normal !== null && !runsAlong(last, to.normal, -1)) return false;
  let seg = 0;
  let along = 0;
  for (const w of waypoints) {
    for (; seg < n - 1; seg++, along = 0) {
      const t = onSegment(w, points[seg]!, points[seg + 1]!);
      if (t !== null && t >= along) {
        along = t;
        break;
      }
    }
    if (seg === n - 1) return false;
  }
  return true;
}
