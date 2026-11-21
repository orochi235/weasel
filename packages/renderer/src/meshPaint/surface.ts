import { lerp, type Rect } from '@weasel-js/geom';

/**
 * Coons and tensor-product patch surfaces — PDF's shading types 6 and 7, as
 * pure geometry.
 *
 * A patch is a curved quadrilateral: four cubic Bézier edges and a color at
 * each corner. A Coons patch reads its interior off the boundary alone; a
 * tensor patch adds four interior control points that pull it around.
 */

/** A point in the patch's own space. */
export interface MeshPoint {
  x: number;
  y: number;
}

/**
 * One patch.
 *
 * `points` walks the boundary: corner 0, the two control points of the edge
 * leaving it, corner 1, its two, and so on — twelve points, ending with the
 * two controls that return to corner 0. A tensor patch appends its four
 * interior points, in the order `(1,1)`, `(1,2)`, `(2,2)`, `(2,1)` of the
 * bicubic control net, which is PDF's own order. Twelve points is a Coons
 * patch and sixteen is a tensor patch.
 *
 * `colors` are the corner colors in the same walk order.
 */
export interface MeshPatch<TColor = string> {
  points: readonly MeshPoint[];
  colors: readonly [TColor, TColor, TColor, TColor];
}

/** Corner `i` of the boundary walk. */
export function patchCorner(patch: MeshPatch<unknown>, i: number): MeshPoint {
  return patch.points[(i & 3) * 3];
}

/** `true` when the patch carries the four interior points a tensor patch adds. */
export function isTensorPatch(patch: MeshPatch<unknown>): boolean {
  return patch.points.length >= 16;
}

/** A patch is twelve boundary points, or sixteen with the interior, and four
 *  corner colors. Anything else cannot be evaluated, and saying so here beats painting nonsense. */
export function isValidPatch(patch: MeshPatch<unknown>): boolean {
  return (patch.points.length === 12 || patch.points.length === 16) && patch.colors.length === 4;
}

function bezier(p0: MeshPoint, p1: MeshPoint, p2: MeshPoint, p3: MeshPoint, t: number): MeshPoint {
  const s = 1 - t;
  const a = s * s * s;
  const b = 3 * s * s * t;
  const c = 3 * s * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** The edge leaving corner `i`, as its four control points. */
function edge(patch: MeshPatch<unknown>, i: number): [MeshPoint, MeshPoint, MeshPoint, MeshPoint] {
  const p = patch.points;
  const a = (i & 3) * 3;
  return [p[a], p[a + 1], p[a + 2], p[((i + 1) & 3) * 3]];
}

/**
 * The patch surface at `(u, v)`, both in `0..1`.
 *
 * `u` runs along the edge leaving corner 0 and `v` along the edge leaving
 * corner 1, so `(0,0)` is corner 0, `(1,0)` corner 1, `(1,1)` corner 2 and
 * `(0,1)` corner 3 — the same walk `colors` is in.
 */
export function evalPatch(patch: MeshPatch<unknown>, u: number, v: number): MeshPoint {
  return isTensorPatch(patch) ? evalTensor(patch, u, v) : evalCoons(patch, u, v);
}

function evalCoons(patch: MeshPatch<unknown>, u: number, v: number): MeshPoint {
  const [b0, b1, b2, b3] = edge(patch, 0);        // corner 0 → 1, along u at v=0
  const [r0, r1, r2, r3] = edge(patch, 1);        // corner 1 → 2, along v at u=1
  const [t0, t1, t2, t3] = edge(patch, 2);        // corner 2 → 3, along u at v=1
  const [l0, l1, l2, l3] = edge(patch, 3);        // corner 3 → 0, along v at u=0

  const bottom = bezier(b0, b1, b2, b3, u);
  const top = bezier(t0, t1, t2, t3, 1 - u);      // walks 2 → 3, so reverse it
  const right = bezier(r0, r1, r2, r3, v);
  const left = bezier(l0, l1, l2, l3, 1 - v);     // walks 3 → 0, so reverse it

  const c0 = patchCorner(patch, 0);
  const c1 = patchCorner(patch, 1);
  const c2 = patchCorner(patch, 2);
  const c3 = patchCorner(patch, 3);

  // The Coons construction: the two ruled surfaces between opposite edges,
  // minus the bilinear surface through the corners they both already carry.
  const ruledU = (a: number, b: number): number => (1 - v) * a + v * b;
  const ruledV = (a: number, b: number): number => (1 - u) * a + u * b;
  const corner = (k0: number, k1: number, k2: number, k3: number): number =>
    (1 - u) * (1 - v) * k0 + u * (1 - v) * k1 + u * v * k2 + (1 - u) * v * k3;

  return {
    x: ruledU(bottom.x, top.x) + ruledV(left.x, right.x)
      - corner(c0.x, c1.x, c2.x, c3.x),
    y: ruledU(bottom.y, top.y) + ruledV(left.y, right.y)
      - corner(c0.y, c1.y, c2.y, c3.y),
  };
}

/** The bicubic control net a tensor patch's sixteen points make, as
 *  `net[i][j]` with `i` along `u` and `j` along `v`. */
function tensorNet(patch: MeshPatch<unknown>): MeshPoint[][] {
  const p = patch.points;
  // Boundary, read off the same walk; interior from the four trailing points.
  return [
    [p[0], p[11], p[10], p[9]],
    [p[1], p[12], p[15], p[8]],
    [p[2], p[13], p[14], p[7]],
    [p[3], p[4], p[5], p[6]],
  ];
}

const BERNSTEIN = (t: number): [number, number, number, number] => {
  const s = 1 - t;
  return [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t];
};

function evalTensor(patch: MeshPatch<unknown>, u: number, v: number): MeshPoint {
  const net = tensorNet(patch);
  const bu = BERNSTEIN(u);
  const bv = BERNSTEIN(v);
  let x = 0;
  let y = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const w = bu[i] * bv[j];
      x += w * net[i][j].x;
      y += w * net[i][j].y;
    }
  }
  return { x, y };
}

/**
 * The four corner weights at `(u, v)` — bilinear, in the corner walk order.
 */
export function cornerWeights(u: number, v: number): [number, number, number, number] {
  return [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
}

/** Axis-aligned bounds of a patch: the union, over a `steps` × `steps` split of it, of each piece's control
 *  net. A piece's net encloses the piece, so the box encloses the surface, and it closes in on it as the
 *  pieces shrink, where the control points of the whole patch alone bound it loosely. */
export function patchBounds(
  patch: MeshPatch<unknown>, steps = 8,
): Rect {
  const net = bicubicNet(patch);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < steps; i++) {
    const s0 = i / steps, s1 = (i + 1) / steps;
    const rows = net.map((row) => [0, 1, 2, 3].map((k) => blossomAt(row, k, s0, s1)));
    for (let j = 0; j < steps; j++) {
      const t0 = j / steps, t1 = (j + 1) / steps;
      for (let a = 0; a < 4; a++) {
        const column = [rows[0][a], rows[1][a], rows[2][a], rows[3][a]];
        for (let b = 0; b < 4; b++) {
          const p = blossomAt(column, b, t0, t1);
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
      }
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The bicubic net a patch evaluates as, indexed `[u][v]` as `tensorNet` is: a Coons patch's interior is the
 *  one that makes the tensor surface equal the Coons one (PDF's type 6 to type 7 rule). */
export function bicubicNet(patch: MeshPatch<unknown>): MeshPoint[][] {
  if (isTensorPatch(patch)) return tensorNet(patch);
  const p = patch.points;
  const n: MeshPoint[][] = [
    [p[0], p[11], p[10], p[9]],
    [p[1], p[1], p[1], p[8]],
    [p[2], p[2], p[2], p[7]],
    [p[3], p[4], p[5], p[6]],
  ];
  for (const i of [1, 2]) {
    for (const j of [1, 2]) {
      const I = i === 1 ? 0 : 3, J = j === 1 ? 0 : 3, fI = 3 - I, fJ = 3 - J;
      const mix = (k: 'x' | 'y'): number => (
        -4 * n[I][J][k] + 6 * (n[I][j][k] + n[i][J][k]) - 2 * (n[I][fJ][k] + n[fI][J][k])
        + 3 * (n[fI][j][k] + n[i][fJ][k]) - n[fI][fJ][k]
      ) / 9;
      n[i][j] = { x: mix('x'), y: mix('y') };
    }
  }
  return n;
}

/** Control point `k` of the cubic `c` cut to `[a, b]`: its blossom at `a` taken `3 − k` times and `b` `k` times. */
function blossomAt(c: readonly MeshPoint[], k: number, a: number, b: number): MeshPoint {
  const ts = [k > 2 ? b : a, k > 1 ? b : a, k > 0 ? b : a];
  let pts = c;
  for (const t of ts) {
    const next: MeshPoint[] = [];
    for (let m = 0; m + 1 < pts.length; m++) {
      next.push({ x: lerp(pts[m].x, pts[m + 1].x, t), y: lerp(pts[m].y, pts[m + 1].y, t) });
    }
    pts = next;
  }
  return pts[0];
}
