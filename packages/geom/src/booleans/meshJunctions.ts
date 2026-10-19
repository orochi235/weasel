/**
 * Closing a mesh's T-junctions before its triangles are unioned. A stroke
 * ribbon puts vertices partway along its neighbors' edges (a join's pivot on
 * a segment's end), and stored as float32 they land a hair to one side. The
 * union then sees two edges that nearly meet instead of one shared edge, and
 * keeps the crack or overlap between them as slivers.
 */
import type { Ring } from './adapter';

/** How near an edge a vertex counts as on it: eight float32 ulps of the
 *  largest coordinate. */
const ON_EDGE = 2 ** -20;

/**
 * Each triangle of the mesh as a closed ring, with every mesh vertex lying on
 * one of its edges inserted into that edge, so that neighbors meeting along
 * an edge share its points exactly. `triangles` holds three vertex indices
 * per triangle, into `vertices` as x, y pairs.
 */
export function junctionRings(vertices: ArrayLike<number>, triangles: readonly number[]): Ring[] {
  const n = vertices.length / 2;
  let scale = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = vertices[i * 2], y = vertices[i * 2 + 1];
    scale = Math.max(scale, Math.abs(x), Math.abs(y));
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const eps = scale * ON_EDGE;
  const cell = Math.max(maxX - minX, maxY - minY, eps) / Math.max(1, Math.sqrt(n));
  const grid = new Map<string, number[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  for (const i of new Set(triangles)) {
    const k = key(Math.floor((vertices[i * 2] - minX) / cell), Math.floor((vertices[i * 2 + 1] - minY) / cell));
    const bucket = grid.get(k);
    if (bucket) bucket.push(i); else grid.set(k, [i]);
  }

  const onEdge = (p: number, q: number): number[] => {
    const px = vertices[p * 2], py = vertices[p * 2 + 1];
    const dx = vertices[q * 2] - px, dy = vertices[q * 2 + 1] - py;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return [];
    const len = Math.sqrt(len2);
    const hits: { i: number; t: number }[] = [];
    const x0 = Math.floor((Math.min(px, px + dx) - eps - minX) / cell), x1 = Math.floor((Math.max(px, px + dx) + eps - minX) / cell);
    const y0 = Math.floor((Math.min(py, py + dy) - eps - minY) / cell), y1 = Math.floor((Math.max(py, py + dy) + eps - minY) / cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        for (const i of grid.get(key(cx, cy)) ?? []) {
          const vx = vertices[i * 2] - px, vy = vertices[i * 2 + 1] - py;
          const t = (vx * dx + vy * dy) / len2;
          if (t * len <= eps || (1 - t) * len <= eps) continue;
          if (Math.abs(vx * dy - vy * dx) / len <= eps) hits.push({ i, t });
        }
      }
    }
    return hits.sort((a, b) => a.t - b.t).map((h) => h.i);
  };

  const rings: Ring[] = [];
  for (let k = 0; k + 2 < triangles.length; k += 3) {
    const ring: Ring = [];
    for (let e = 0; e < 3; e++) {
      const p = triangles[k + e], q = triangles[k + ((e + 1) % 3)];
      for (const i of [p, ...onEdge(p, q)]) ring.push([vertices[i * 2], vertices[i * 2 + 1]]);
    }
    ring.push(ring[0]);
    rings.push(ring);
  }
  return rings;
}
