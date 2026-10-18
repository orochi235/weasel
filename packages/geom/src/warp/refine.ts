/**
 * Points added inside a triangulated region, and its triangles flipped toward
 * Delaunay (Lawson's flips): each added point splits the triangle holding it,
 * and an edge two triangles share is flipped while the far corner of one lies
 * inside the other's circumcircle. An edge only one triangle has — the
 * region's outline — is never flipped, so the triangles stay inside it.
 */

/** Twice the signed area of `(a, b, c)`; positive when counter-clockwise. */
function orient(V: number[], a: number, b: number, c: number): number {
  return (V[2 * b] - V[2 * a]) * (V[2 * c + 1] - V[2 * a + 1]) - (V[2 * b + 1] - V[2 * a + 1]) * (V[2 * c] - V[2 * a]);
}

/** Whether `d` lies inside the circle through counter-clockwise `(a, b, c)`. */
function inCircle(V: number[], a: number, b: number, c: number, d: number): boolean {
  const ax = V[2 * a] - V[2 * d], ay = V[2 * a + 1] - V[2 * d + 1];
  const bx = V[2 * b] - V[2 * d], by = V[2 * b + 1] - V[2 * d + 1];
  const cx = V[2 * c] - V[2 * d], cy = V[2 * c + 1] - V[2 * d + 1];
  const det = (ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay)
    + (cx * cx + cy * cy) * (ax * by - bx * ay);
  return det > 1e-12 * (ax * ax + ay * ay + bx * bx + by * by + cx * cx + cy * cy) ** 2;
}

class Triangulation {
  readonly tris: number[] = [];
  /** Directed edge `a→b` to the triangle having it, counter-clockwise. */
  private readonly owner = new Map<number, number>();
  private readonly free: number[] = [];
  /** The triangle made last, where the next point's search starts. */
  private last = 0;

  constructor(private readonly V: number[], private readonly stride: number) {}

  private key(a: number, b: number): number { return a * this.stride + b; }

  add(a: number, b: number, c: number): number {
    const t = this.free.pop() ?? this.tris.length / 3;
    this.last = t;
    this.tris[3 * t] = a; this.tris[3 * t + 1] = b; this.tris[3 * t + 2] = c;
    this.owner.set(this.key(a, b), t); this.owner.set(this.key(b, c), t); this.owner.set(this.key(c, a), t);
    return t;
  }

  remove(t: number): void {
    const [a, b, c] = this.corners(t);
    for (const [u, v] of [[a, b], [b, c], [c, a]]) if (this.owner.get(this.key(u, v)) === t) this.owner.delete(this.key(u, v));
    this.tris[3 * t] = -1;
    this.free.push(t);
  }

  corners(t: number): [number, number, number] {
    return [this.tris[3 * t], this.tris[3 * t + 1], this.tris[3 * t + 2]];
  }

  /** The triangle across edge `a→b` and its corner off that edge, if any. */
  across(a: number, b: number): { t: number; c: number } | null {
    const t = this.owner.get(this.key(b, a));
    if (t === undefined) return null;
    const [x, y, z] = this.corners(t);
    return { t, c: x !== a && x !== b ? x : y !== a && y !== b ? y : z };
  }

  /** Flip edge `a→b` of the triangle `(a, b, p)` while the triangle across it disagrees. */
  legalize(a: number, b: number, p: number): void {
    const stack: [number, number, number][] = [[a, b, p]];
    while (stack.length > 0) {
      const [u, v, w] = stack.pop()!;
      const mine = this.owner.get(this.key(u, v));
      const other = this.across(u, v);
      if (mine === undefined || !other || !inCircle(this.V, u, v, w, other.c)) continue;
      const q = other.c;
      if (orient(this.V, u, q, w) <= 0 || orient(this.V, q, v, w) <= 0) continue;
      this.remove(mine);
      this.remove(other.t);
      this.add(u, q, w);
      this.add(q, v, w);
      stack.push([u, q, w], [q, v, w]);
    }
  }

  /** Whether triangle `t` holds `p`, and on which edge if on one: -1 outside, 3 strictly inside. */
  private holds(t: number, p: number): number {
    const V = this.V;
    const [a, b, c] = this.corners(t);
    const area = orient(V, a, b, c);
    const ws = [orient(V, b, c, p), orient(V, c, a, p), orient(V, a, b, p)];
    if (ws.some((w) => w < -1e-9 * area)) return -1;
    const flat = ws.findIndex((w) => w <= 1e-9 * area);
    return flat < 0 ? 3 : flat;
  }

  /** The triangle holding `p`: walked to from `from` across the edges `p` lies beyond, or
   *  found by a scan when the walk leaves the region. */
  private locate(p: number, from: number): { t: number; on: number } | null {
    let t = from;
    for (let step = 0; t >= 0 && this.tris[3 * t] >= 0 && step < this.tris.length; step++) {
      const on = this.holds(t, p);
      if (on >= 0) return { t, on };
      const [a, b, c] = this.corners(t);
      const edge = [[b, c], [c, a], [a, b]].find(([u, v]) => orient(this.V, u, v, p) < 0)!;
      t = this.across(edge[0], edge[1])?.t ?? -1;
    }
    for (let s = 0; s < this.tris.length / 3; s++) {
      if (this.tris[3 * s] < 0) continue;
      const on = this.holds(s, p);
      if (on >= 0) return { t: s, on };
    }
    return null;
  }

  /** Split the triangle holding `p` (or the two sharing the edge it lies on). False when none holds it. */
  insert(p: number): boolean {
    const found = this.locate(p, this.last);
    if (!found) return false;
    const { t } = found;
    const [a, b, c] = this.corners(t);
    const flat = found.on === 3 ? -1 : found.on;
    if (flat < 0) {
      this.remove(t);
      this.add(a, b, p); this.add(b, c, p); this.add(c, a, p);
      this.legalize(a, b, p); this.legalize(b, c, p); this.legalize(c, a, p);
      return true;
    }
    // On edge u→v of this triangle, opposite corner w.
    const [u, v, w] = [[b, c, a], [c, a, b], [a, b, c]][flat];
    const other = this.across(u, v);
    this.remove(t);
    this.add(v, w, p); this.add(w, u, p);
    const rim: [number, number][] = [[v, w], [w, u]];
    if (other) {
      this.remove(other.t);
      this.add(u, other.c, p); this.add(other.c, v, p);
      rim.push([u, other.c], [other.c, v]);
    }
    for (const [x, y] of rim) this.legalize(x, y, p);
    return true;
  }
}

/**
 * `triangles` over `coords`, with the points from vertex `firstInner` on
 * inserted inside it and every triangle flipped toward Delaunay. A point no
 * triangle holds is left out of the mesh. Returns the new triangles.
 */
export function refineTriangulation(coords: number[], triangles: ArrayLike<number>, firstInner: number): number[] {
  const n = coords.length / 2;
  const mesh = new Triangulation(coords, n);
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    const [a, b, c] = [triangles[i], triangles[i + 1], triangles[i + 2]];
    const o = orient(coords, a, b, c);
    if (o > 0) mesh.add(a, b, c);
    else if (o < 0) mesh.add(a, c, b);
  }
  const live = () => Array.from({ length: mesh.tris.length / 3 }, (_, t) => t).filter((t) => mesh.tris[3 * t] >= 0);
  for (const t of live()) {
    if (mesh.tris[3 * t] < 0) continue;
    const [a, b, c] = mesh.corners(t);
    mesh.legalize(a, b, c); mesh.legalize(b, c, a); mesh.legalize(c, a, b);
  }
  for (let p = firstInner; p < n; p++) mesh.insert(p);
  return live().flatMap((t) => mesh.corners(t));
}
