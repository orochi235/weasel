/** Polyline arithmetic shared by the routers and route editing. */
import type { Vec2 } from '@weasel-js/core/math';

const EPS = 1e-6;

const same = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;

/** `points` without repeats, and without any interior point lying straight
 *  between its neighbors. The first and last always stay. */
export function simplifyStops(points: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    if (out.length > 0 && same(out[out.length - 1]!, p)) continue;
    while (out.length >= 2 && between(out[out.length - 2]!, out[out.length - 1]!, p)) out.pop();
    out.push(p);
  }
  return out;
}

/** Whether `m` lies on the segment from `a` to `b`, going the same way. */
function between(a: Vec2, m: Vec2, b: Vec2): boolean {
  const cross = (m.x - a.x) * (b.y - a.y) - (m.y - a.y) * (b.x - a.x);
  const dot = (m.x - a.x) * (b.x - m.x) + (m.y - a.y) * (b.y - m.y);
  return Math.abs(cross) <= EPS && dot > 0;
}
