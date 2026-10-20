/**
 * Where connectors cross, as the hops the upper one of each pair makes over
 * the lower. Arithmetic on polylines: nothing here reads a scene.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { SpatialHash } from '../avoid/hash';
import type { EdgeHop } from './types';

interface Segment {
  edge: string;
  rank: number;
  a: Vec2;
  b: Vec2;
}

/** One crossing on a hopping segment, `t` world units along it. */
interface Crossing {
  t: number;
  over: string;
}

const EPS = 1e-9;

const round = (v: number): number => Math.round(v * 1000) / 1000;

const boxOf = (a: Vec2, b: Vec2) => ({
  x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y),
});

/** Where segments `p` and `q` cross at one point inside both, as the
 *  fraction along `p`; null for a touch at an end, parallel, or apart. */
function properCrossing(p: Segment, q: Segment): number | null {
  const rx = p.b.x - p.a.x;
  const ry = p.b.y - p.a.y;
  const sx = q.b.x - q.a.x;
  const sy = q.b.y - q.a.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) <= EPS * Math.hypot(rx, ry) * Math.hypot(sx, sy)) return null;
  const qx = q.a.x - p.a.x;
  const qy = q.a.y - p.a.y;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  return t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS ? t : null;
}

const far = (p: Vec2, ends: readonly Vec2[], d: number): boolean => ends.every((e) => Math.hypot(p.x - e.x, p.y - e.y) >= d);

/** The hops along one segment of radius `r`, nearer ones merged. */
function mergeAlong(seg: Segment, found: Crossing[], r: number): EdgeHop[] {
  found.sort((m, n) => m.t - n.t);
  const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
  const out: EdgeHop[] = [];
  let run: { from: number; to: number; over: string[] } | null = null;
  const flush = () => {
    if (run === null) return;
    const mid = (run.from + run.to) / 2 / len;
    out.push({
      at: { x: round(seg.a.x + (seg.b.x - seg.a.x) * mid), y: round(seg.a.y + (seg.b.y - seg.a.y) * mid) },
      over: run.over,
      r: round((run.to - run.from) / 2 + r),
    });
  };
  for (const c of found) {
    if (run !== null && c.t - run.to < 2 * r) {
      run.to = c.t;
      if (!run.over.includes(c.over)) run.over.push(c.over);
      continue;
    }
    flush();
    run = { from: c.t, to: c.t, over: [c.over] };
  }
  flush();
  return out;
}

/**
 * The hops each connector makes where it crosses one drawn before it.
 *
 * `polylines` holds each connector's route by id; `order` is render order, and
 * of two crossing connectors the later one hops. Only proper crossings count:
 * a touch at an end and a collinear overlap are not, nor is a crossing within
 * `2r` of either connector's ends, nor one within `r` of a bend of the
 * hopping connector, where its half circle would not fit. Hops on one segment
 * closer than `2r` merge into one longer hop.
 *
 * Answers every connector of `only` (default: all of `order`), with no hops
 * as an empty list.
 */
export function edgeHops(
  polylines: ReadonlyMap<string, readonly Vec2[]>,
  order: readonly string[],
  r: number,
  only?: ReadonlySet<string>,
): Map<string, EdgeHop[]> {
  const hash = new SpatialHash<Segment>();
  const segments = new Map<string, Segment[]>();
  order.forEach((edge, rank) => {
    const points = polylines.get(edge);
    if (points === undefined) return;
    const list: Segment[] = [];
    for (let i = 1; i < points.length; i++) {
      const seg = { edge, rank, a: points[i - 1]!, b: points[i]! };
      if (seg.a.x === seg.b.x && seg.a.y === seg.b.y) continue;
      list.push(seg);
      hash.insert(seg, boxOf(seg.a, seg.b));
    }
    segments.set(edge, list);
  });
  const endsOf = (edge: string): Vec2[] => {
    const p = polylines.get(edge)!;
    return [p[0]!, p[p.length - 1]!];
  };

  const out = new Map<string, EdgeHop[]>();
  const near: Segment[] = [];
  for (const edge of order) {
    if (only !== undefined && !only.has(edge)) continue;
    const hops: EdgeHop[] = [];
    const ends = segments.has(edge) ? endsOf(edge) : [];
    for (const seg of segments.get(edge) ?? []) {
      const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
      const found: Crossing[] = [];
      near.length = 0;
      for (const other of hash.query(boxOf(seg.a, seg.b), near)) {
        if (other.rank >= seg.rank) continue;
        const f = properCrossing(seg, other);
        if (f === null) continue;
        const t = f * len;
        const at = { x: seg.a.x + (seg.b.x - seg.a.x) * f, y: seg.a.y + (seg.b.y - seg.a.y) * f };
        if (t < r || len - t < r || !far(at, ends, 2 * r) || !far(at, endsOf(other.edge), 2 * r)) continue;
        found.push({ t, over: other.edge });
      }
      if (found.length > 0) hops.push(...mergeAlong(seg, found, r));
    }
    out.set(edge, hops);
  }
  return out;
}
