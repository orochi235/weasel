/**
 * A connector's route drawn with its hops: each one a half circle in place of
 * the stretch of route it spans.
 */
import { PathBuilder, polylineFromPoints, type Path } from '@weasel-js/geom';
import type { Vec2 } from '@weasel-js/core/math';
import type { EdgeHop } from './types';

/** How far off its route a hop may lie and still draw. */
const ON_ROUTE = 0.5;

/** The control distance that makes a cubic a quarter circle, per unit radius. */
const KAPPA = 0.5523;

/** A hop placed on one segment: its center `t` units along it. */
interface Placed {
  t: number;
  r: number;
}

/** The side a hop bulges to: −y on a horizontal run and −x on a vertical one,
 *  whichever way it travels, so every hop on a page bulges alike; else the
 *  left of travel. */
function bulge(u: Vec2): Vec2 {
  if (Math.abs(u.y) < 1e-9) return { x: 0, y: -1 };
  if (Math.abs(u.x) < 1e-9) return { x: -1, y: 0 };
  return { x: u.y, y: -u.x };
}

/** The hops of `hops` that lie on segment `a`–`b` and fit on it, by distance
 *  along it, each starting past the end of the one before. */
function placedOn(a: Vec2, b: Vec2, hops: readonly EdgeHop[]): Placed[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len === 0) return [];
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const found: Placed[] = [];
  for (const hop of hops) {
    const dx = hop.at.x - a.x;
    const dy = hop.at.y - a.y;
    const t = dx * ux + dy * uy;
    if (Math.abs(dx * uy - dy * ux) > ON_ROUTE || t - hop.r < 0 || t + hop.r > len) continue;
    found.push({ t, r: hop.r });
  }
  found.sort((m, n) => m.t - n.t);
  const out: Placed[] = [];
  for (const p of found) {
    const last = out[out.length - 1];
    if (last === undefined || p.t - p.r >= last.t + last.r) out.push(p);
  }
  return out;
}

/**
 * The open path through `points`, bowing over each of `hops` in a half circle
 * of its radius. A hop more than half a unit off the route, or too near a bend
 * or an end for its half circle to fit on one segment, is stale and does not
 * draw; nor does one overlapping the hop before it.
 */
export function withHops(points: readonly Vec2[], hops: readonly EdgeHop[]): Path {
  const b = new PathBuilder();
  const first = points[0];
  if (first === undefined || hops.length === 0) return polylineFromPoints(points);
  b.moveTo(first.x, first.y);
  let arcs = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1]!;
    const q = points[i]!;
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const u = len === 0 ? { x: 1, y: 0 } : { x: (q.x - p.x) / len, y: (q.y - p.y) / len };
    const n = bulge(u);
    for (const { t, r } of placedOn(p, q, hops)) {
      const c = { x: p.x + u.x * t, y: p.y + u.y * t };
      const top = { x: c.x + n.x * r, y: c.y + n.y * r };
      const k = KAPPA * r;
      b.lineTo(c.x - u.x * r, c.y - u.y * r);
      b.curveTo(c.x - u.x * r + n.x * k, c.y - u.y * r + n.y * k, top.x - u.x * k, top.y - u.y * k, top.x, top.y);
      b.curveTo(top.x + u.x * k, top.y + u.y * k, c.x + u.x * r + n.x * k, c.y + u.y * r + n.y * k, c.x + u.x * r, c.y + u.y * r);
      arcs++;
    }
    b.lineTo(q.x, q.y);
  }
  return arcs === 0 ? polylineFromPoints(points) : b.build();
}
