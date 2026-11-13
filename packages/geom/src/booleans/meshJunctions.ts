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

/** Vertices a tree node holds before it splits. */
const LEAF = 8;

/** A box of vertices, split in four once it holds more than `LEAF`. A wide stroke's pivots crowd one small spot
 *  that its longest edges all pass, so a uniform grid's cell there holds most of the mesh. */
interface Node {
  x0: number; y0: number; x1: number; y1: number;
  ids: number[] | null;
  kids: Node[] | null;
}

function build(vertices: ArrayLike<number>, ids: number[], x0: number, y0: number, x1: number, y1: number, depth: number): Node {
  if (ids.length <= LEAF || depth >= 40) return { x0, y0, x1, y1, ids, kids: null };
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const parts: number[][] = [[], [], [], []];
  for (const i of ids) parts[(vertices[i * 2] >= mx ? 1 : 0) + (vertices[i * 2 + 1] >= my ? 2 : 0)]!.push(i);
  const boxes = [[x0, y0, mx, my], [mx, y0, x1, my], [x0, my, mx, y1], [mx, my, x1, y1]];
  return { x0, y0, x1, y1, ids: null, kids: parts.map((p, k) => build(vertices, p, ...(boxes[k] as [number, number, number, number]), depth + 1)) };
}

/** Whether the box of `n`, grown by `eps`, meets the segment from `(px, py)` along `(dx, dy)`. */
function meets(n: Node, px: number, py: number, dx: number, dy: number, len: number, eps: number): boolean {
  const x0 = n.x0 - eps, y0 = n.y0 - eps, x1 = n.x1 + eps, y1 = n.y1 + eps;
  if (Math.max(px, px + dx) < x0 || Math.min(px, px + dx) > x1 || Math.max(py, py + dy) < y0 || Math.min(py, py + dy) > y1) return false;
  // The box's corners on both sides of the segment's line, or within `eps` of it.
  let pos = false, neg = false;
  for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) {
    const side = (dx * (cy - py) - dy * (cx - px)) / len;
    if (side >= -eps) pos = true;
    if (side <= eps) neg = true;
  }
  return pos && neg;
}

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
  const root = build(vertices, [...new Set(triangles)], minX, minY, maxX, maxY, 0);

  const onEdge = (p: number, q: number): number[] => {
    const px = vertices[p * 2], py = vertices[p * 2 + 1];
    const dx = vertices[q * 2] - px, dy = vertices[q * 2 + 1] - py;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return [];
    const len = Math.sqrt(len2);
    const hits: { i: number; t: number }[] = [];
    const visit = (node: Node): void => {
      if (!meets(node, px, py, dx, dy, len, eps)) return;
      if (node.kids) { for (const kid of node.kids) visit(kid); return; }
      for (const i of node.ids!) {
        const vx = vertices[i * 2] - px, vy = vertices[i * 2 + 1] - py;
        const t = (vx * dx + vy * dy) / len2;
        if (t * len <= eps || (1 - t) * len <= eps) continue;
        if (Math.abs(vx * dy - vy * dx) / len <= eps) hits.push({ i, t });
      }
    };
    visit(root);
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
