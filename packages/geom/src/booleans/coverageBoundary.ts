/**
 * The boundary of the region a mesh's outline covers, found edge by edge.
 *
 * A wide stroke's ribbon is a pile of long, thin triangles through one small
 * region, and its outline edges cross each other there about as often as the
 * square of their count. A sweep pays for every crossing as an event and a
 * reordering; here each edge only sorts the crossings along it, keeps the
 * stretches with the region on one side and nothing on the other, and hands
 * the clipper those, which cross nothing.
 *
 * Each edge's winding is taken at its start, from a ray cast at that vertex,
 * and carried along it crossing by crossing. Two crossings closer than their
 * parameters can order only misplace the sliver between them, and the
 * boundary's points are merged at a far finer scale than float32 keeps, so
 * that sliver cannot leave a loop open.
 */
import type { Pair, Ring } from './adapter';
import type { MeshEdge } from './meshOutline';
import { crossingsOf } from './edgeCrossings';
import { leftSector, sectorFacingLeft, sectorWindings, sortRays, type Ray } from './vertexFans';

/** Boundary points nearer than this fraction of the outline's size are one point. */
const SAME_POINT = 2 ** -28;

/**
 * The loops bounding the nonzero region of `edges` (each edge counted `n`
 * times, its region on the left), each with the region on its left and
 * closed, or null where the pieces did not close.
 */
export function coverageBoundary(edges: readonly MeshEdge[]): Ring[] | null {
  const xs: number[] = [], ys: number[] = [];
  const ids = new Map<string, number>();
  const vertex = (x: number, y: number): number => {
    const k = `${x},${y}`;
    let id = ids.get(k);
    if (id === undefined) { id = xs.length; ids.set(k, id); xs.push(x); ys.push(y); }
    return id;
  };
  const from = edges.map((e) => vertex(e.ax, e.ay));
  const to = edges.map((e) => vertex(e.bx, e.by));
  const vertices = xs.length;
  const start = windingsAtStart(edges, from, to, xs, ys);
  const cross = crossingsOf(edges);

  // A crossing's point is numbered past the vertices, by its pair, and placed along the first of its two edges.
  const pieces: number[] = [];
  edges.forEach((e, i) => {
    let w = start[i]!, at = from[i]!;
    const piece = (next: number): void => {
      const left = w !== 0, right = w - e.n !== 0;
      if (left !== right) pieces.push(left ? at : next, left ? next : at);
    };
    for (let k = cross.first[i]!; k < cross.first[i + 1]!; k++) {
      const c = cross.order[k]!, next = vertices + (c >> 1);
      piece(next);
      at = next;
      w += cross.step[c]!;
    }
    piece(to[i]!);
  });
  const point = (id: number): Pair => {
    if (id < vertices) return [xs[id]!, ys[id]!];
    const c = (id - vertices) * 2, e = edges[cross.edge[c]!]!, t = cross.t[c]!;
    return [e.ax + (e.bx - e.ax) * t, e.ay + (e.by - e.ay) * t];
  };
  let size = 0;
  for (const e of edges) size = Math.max(size, Math.abs(e.ax), Math.abs(e.ay), Math.abs(e.bx), Math.abs(e.by));
  return loopsOf(pieces, point, size * SAME_POINT);
}

/** The winding just left of each edge where it starts: around each vertex from the sector facing straight left,
 *  where a ray cast finds it. */
function windingsAtStart(
  edges: readonly MeshEdge[], from: readonly number[], to: readonly number[], xs: readonly number[], ys: readonly number[],
): Float64Array {
  const rays: Ray[][] = Array.from({ length: xs.length }, () => []);
  edges.forEach((e, i) => {
    const dx = e.bx - e.ax, dy = e.by - e.ay;
    rays[from[i]!]!.push({ sub: i, out: true, dx, dy, n: e.n });
    rays[to[i]!]!.push({ sub: i, out: false, dx: -dx, dy: -dy, n: e.n });
  });
  const ax = Float64Array.from(edges, (e) => e.ax), ay = Float64Array.from(edges, (e) => e.ay);
  const bx = Float64Array.from(edges, (e) => e.bx), by = Float64Array.from(edges, (e) => e.by);
  const n = Int32Array.from(edges, (e) => e.n);
  const start = new Float64Array(edges.length);
  rays.forEach((list, v) => {
    if (!list.some((r) => r.out)) return;
    const sorted = sortRays(list);
    const sectors = sectorWindings(sorted, sectorFacingLeft(sorted), windingLeftOf(ax, ay, bx, by, n, xs[v]!, ys[v]!));
    sorted.forEach((r, k) => { if (r.out) start[r.sub] = sectors[leftSector(sorted, k)]!; });
  });
  return start;
}

/** The winding of the edges just left of `(x, y)`, by a ray from it straight left. */
function windingLeftOf(
  ax: Float64Array, ay: Float64Array, bx: Float64Array, by: Float64Array, n: Int32Array, x: number, y: number,
): number {
  let w = 0;
  for (let j = 0; j < ax.length; j++) {
    const y0 = ay[j]!, y1 = by[j]!;
    if ((y0 > y) === (y1 > y)) continue;
    const x0 = ax[j]!;
    // Crossing the ray going down, toward −y, is crossing it from its right to its left.
    if (x0 + ((y - y0) / (y1 - y0)) * (bx[j]! - x0) < x) w += y1 < y0 ? n[j]! : -n[j]!;
  }
  return w;
}

/**
 * Directed pieces, flat `from, to` pairs, chained into closed loops of
 * points once points within `near` of one another are one, or null when one
 * does not close.
 */
function loopsOf(pieces: number[], point: (id: number) => Pair, near: number): Ring[] | null {
  const merged = mergeNear(pieces, point, near);
  const next = new Map<number, number[]>();
  for (let k = 0; k < pieces.length; k += 2) {
    const a = merged.get(pieces[k]!)!, b = merged.get(pieces[k + 1]!)!;
    if (a === b) continue;
    const back = next.get(b);
    const undo = back ? back.lastIndexOf(a) : -1;
    if (undo >= 0) { back!.splice(undo, 1); continue; }
    const list = next.get(a);
    if (list) list.push(b); else next.set(a, [b]);
  }
  const loops: Ring[] = [];
  for (const begin of next.keys()) {
    while ((next.get(begin)?.length ?? 0) > 0) {
      const loop: Pair[] = [point(begin)];
      let at = next.get(begin)!.pop()!;
      while (at !== begin) {
        loop.push(point(at));
        const list = next.get(at);
        if (!list || list.length === 0) return null;
        at = list.pop()!;
      }
      const straight = straightened(loop);
      if (straight.length > 3) loops.push(straight);
    }
  }
  return loops;
}

/** Each point of `pieces` as the least id of the points within `near` of it, through any chain of such points. */
function mergeNear(pieces: number[], point: (id: number) => Pair, near: number): Map<number, number> {
  const parent = new Map<number, number>();
  const find = (a: number): number => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(a, r);
    return r;
  };
  const cells = new Map<string, number[]>();
  const cell = Math.max(near, Number.MIN_VALUE);
  for (const id of new Set(pieces)) {
    parent.set(id, id);
    const [x, y] = point(id);
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
          const [ox, oy] = point(other);
          if (Math.abs(ox - x) > near || Math.abs(oy - y) > near) continue;
          const a = find(id), b = find(other);
          if (a !== b) parent.set(Math.max(a, b), Math.min(a, b));
        }
      }
    }
    const key = `${cx},${cy}`;
    const list = cells.get(key);
    if (list) list.push(id); else cells.set(key, [id]);
  }
  const out = new Map<number, number>();
  for (const id of parent.keys()) out.set(id, find(id));
  return out;
}

/** `loop` with each point that sits exactly on the line through its neighbors, going on, left out, and closed. */
function straightened(loop: Pair[]): Ring {
  const out: Pair[] = [];
  const bends = (a: Pair, b: Pair, c: Pair): boolean => {
    const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
    return ux * vy - uy * vx !== 0 || ux * vx + uy * vy <= 0;
  };
  for (const p of loop) {
    while (out.length >= 2 && !bends(out[out.length - 2]!, out[out.length - 1]!, p)) out.pop();
    out.push(p);
  }
  // The seam: the first points against the last.
  while (out.length >= 3 && !bends(out[out.length - 2]!, out[out.length - 1]!, out[0]!)) out.pop();
  while (out.length >= 3 && !bends(out[out.length - 1]!, out[0]!, out[1]!)) out.shift();
  out.push(out[0]!);
  return out;
}
