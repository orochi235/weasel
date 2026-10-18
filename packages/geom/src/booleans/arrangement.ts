/**
 * The planar arrangement of several polygon sets' boundaries: every edge split
 * where it meets another, coincident points merged, and the result stored as
 * half-edges linked around the faces they bound.
 */
import type { MultiPolygon } from './adapter';

/**
 * Half-edge `h` runs from `origin[h]` to `origin[h ^ 1]`, so `h ^ 1` is its
 * twin; `next[h]` continues around the face on `h`'s left. `owners[h >> 1]`
 * has bit `i` set when input `i`'s boundary runs along that edge an odd number
 * of times, so crossing the edge toggles exactly those inputs.
 */
export interface Arrangement {
  xs: number[];
  ys: number[];
  origin: number[];
  next: number[];
  owners: bigint[];
}

interface Cut { t: number; x: number; y: number }

interface Seg {
  ax: number; ay: number; bx: number; by: number;
  input: number;
  minX: number; maxX: number; minY: number; maxY: number;
  cuts: Cut[];
}

/** Merges points closer than `eps` (per axis) into one vertex. */
class VertexPool {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  private readonly cells = new Map<string, number[]>();
  private readonly cell: number;
  constructor(private readonly eps: number) { this.cell = eps * 2; }

  id(x: number, y: number): number {
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const v of this.cells.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (Math.abs(this.xs[v]! - x) <= this.eps && Math.abs(this.ys[v]! - y) <= this.eps) return v;
        }
      }
    }
    const v = this.xs.length;
    this.xs.push(x);
    this.ys.push(y);
    const key = `${cx},${cy}`;
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(v);
    else this.cells.set(key, [v]);
    return v;
  }
}

function segmentsOf(inputs: readonly MultiPolygon[]): { segs: Seg[]; extent: number } {
  const segs: Seg[] = [];
  let extent = 0;
  inputs.forEach((mp, input) => {
    for (const polygon of mp) {
      for (const ring of polygon) {
        for (let k = 0; k + 1 < ring.length; k++) {
          const [ax, ay] = ring[k]!;
          const [bx, by] = ring[k + 1]!;
          if (ax === bx && ay === by) continue;
          extent = Math.max(extent, Math.abs(ax), Math.abs(ay), Math.abs(bx), Math.abs(by));
          segs.push({
            ax, ay, bx, by, input,
            minX: Math.min(ax, bx), maxX: Math.max(ax, bx),
            minY: Math.min(ay, by), maxY: Math.max(ay, by),
            cuts: [],
          });
        }
      }
    }
  });
  return { segs, extent };
}

/** Cuts `seg` at `(px, py)` when that point lies on it, short of its ends. */
function cutAtPoint(seg: Seg, px: number, py: number, eps: number): void {
  const rx = seg.bx - seg.ax, ry = seg.by - seg.ay;
  const len2 = rx * rx + ry * ry;
  const t = ((px - seg.ax) * rx + (py - seg.ay) * ry) / len2;
  if (t <= 0 || t >= 1) return;
  const ex = seg.ax + t * rx - px, ey = seg.ay + t * ry - py;
  if (ex * ex + ey * ey <= eps * eps) seg.cuts.push({ t, x: px, y: py });
}

function cutPair(s: Seg, o: Seg, eps: number): void {
  const rx = s.bx - s.ax, ry = s.by - s.ay;
  const sx = o.bx - o.ax, sy = o.by - o.ay;
  const d = rx * sy - ry * sx;
  const lenR = Math.hypot(rx, ry), lenS = Math.hypot(sx, sy);
  if (Math.abs(d) > 1e-12 * lenR * lenS) {
    const qx = o.ax - s.ax, qy = o.ay - s.ay;
    const t = (qx * sy - qy * sx) / d;
    const u = (qx * ry - qy * rx) / d;
    const tolT = eps / lenR, tolU = eps / lenS;
    if (t > -tolT && t < 1 + tolT && u > -tolU && u < 1 + tolU) {
      const tc = Math.min(1, Math.max(0, t));
      const x = s.ax + tc * rx, y = s.ay + tc * ry;
      s.cuts.push({ t: tc, x, y });
      o.cuts.push({ t: Math.min(1, Math.max(0, u)), x, y });
    }
  }
  // Ends lying on the other segment: T-junctions and collinear overlaps.
  cutAtPoint(s, o.ax, o.ay, eps);
  cutAtPoint(s, o.bx, o.by, eps);
  cutAtPoint(o, s.ax, s.ay, eps);
  cutAtPoint(o, s.bx, s.by, eps);
}

function cutAll(segs: Seg[], eps: number): void {
  const order = segs.map((_, i) => i).sort((i, j) => segs[i]!.minX - segs[j]!.minX);
  for (let a = 0; a < order.length; a++) {
    const s = segs[order[a]!]!;
    for (let b = a + 1; b < order.length; b++) {
      const o = segs[order[b]!]!;
      if (o.minX > s.maxX + eps) break;
      if (o.minY > s.maxY + eps || o.maxY < s.minY - eps) continue;
      cutPair(s, o, eps);
    }
  }
}

function linkFaces(xs: number[], ys: number[], origin: number[]): number[] {
  const out: number[][] = xs.map(() => []);
  const angle: number[] = [];
  for (let h = 0; h < origin.length; h++) {
    const u = origin[h]!, v = origin[h ^ 1]!;
    out[u]!.push(h);
    angle[h] = Math.atan2(ys[v]! - ys[u]!, xs[v]! - xs[u]!);
  }
  const slot: number[] = [];
  for (const list of out) {
    list.sort((a, b) => angle[a]! - angle[b]!);
    list.forEach((h, k) => { slot[h] = k; });
  }
  // Leaving the head of `h`, the face on its left continues along the
  // outgoing edge just clockwise of the way back.
  return origin.map((_, h) => {
    const list = out[origin[h ^ 1]!]!;
    return list[(slot[h ^ 1]! - 1 + list.length) % list.length]!;
  });
}

/** Builds the arrangement of the rings of `inputs`, input `i` owning bit `i`. */
export function buildArrangement(inputs: readonly MultiPolygon[]): Arrangement {
  const { segs, extent } = segmentsOf(inputs);
  const eps = 1e-9 * Math.max(1, extent);
  cutAll(segs, eps);

  const pool = new VertexPool(eps);
  const edges = new Map<string, { u: number; v: number; owners: bigint }>();
  for (const seg of segs) {
    const points = [{ t: 0, x: seg.ax, y: seg.ay }, ...seg.cuts, { t: 1, x: seg.bx, y: seg.by }]
      .sort((a, b) => a.t - b.t);
    const bit = 1n << BigInt(seg.input);
    let prev = pool.id(points[0]!.x, points[0]!.y);
    for (let k = 1; k < points.length; k++) {
      const id = pool.id(points[k]!.x, points[k]!.y);
      if (id === prev) continue;
      const u = Math.min(prev, id), v = Math.max(prev, id);
      const key = `${u},${v}`;
      const edge = edges.get(key);
      if (edge) edge.owners ^= bit;
      else edges.set(key, { u, v, owners: bit });
      prev = id;
    }
  }

  const origin: number[] = [];
  const owners: bigint[] = [];
  for (const { u, v, owners: o } of edges.values()) {
    if (o === 0n) continue;
    origin.push(u, v);
    owners.push(o);
  }
  return { xs: pool.xs, ys: pool.ys, origin, next: linkFaces(pool.xs, pool.ys, origin), owners };
}
