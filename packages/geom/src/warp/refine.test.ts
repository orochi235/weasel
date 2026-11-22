import earcut from 'earcut';
import { describe, expect, it } from 'vitest';
import { refineTriangulation } from './refine';

/** Edges two triangles share whose far corner lies inside the other's circumcircle, the pair convex. */
function illegalEdges(V: number[], tris: number[]): number {
  const owner = new Map<string, number>();
  for (let t = 0; t < tris.length; t += 3) for (let k = 0; k < 3; k++) owner.set(`${tris[t + k]},${tris[t + (k + 1) % 3]}`, t);
  const orient = (a: number, b: number, c: number) =>
    (V[2 * b] - V[2 * a]) * (V[2 * c + 1] - V[2 * a + 1]) - (V[2 * b + 1] - V[2 * a + 1]) * (V[2 * c] - V[2 * a]);
  const inside = (a: number, b: number, c: number, d: number) => {
    const [ax, ay, bx, by, cx, cy] = [a, b, c].flatMap((i) => [V[2 * i] - V[2 * d], V[2 * i + 1] - V[2 * d + 1]]);
    const det = (ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay) + (cx * cx + cy * cy) * (ax * by - bx * ay);
    return det > 1e-9 * (ax * ax + ay * ay + bx * bx + by * by + cx * cx + cy * cy) ** 2;
  };
  let bad = 0;
  for (let t = 0; t < tris.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const u = tris[t + k], v = tris[t + (k + 1) % 3], w = tris[t + (k + 2) % 3];
      const o = owner.get(`${v},${u}`);
      if (o === undefined) continue;
      const q = [tris[o], tris[o + 1], tris[o + 2]].find((x) => x !== u && x !== v)!;
      if (orient(u, q, w) > 0 && orient(q, v, w) > 0 && inside(u, v, w, q)) bad++;
    }
  }
  return bad;
}

describe('refineTriangulation', () => {
  it('leaves an earcut triangulation of a convex outline Delaunay', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let run = 0; run < 40; run++) {
      const n = 8 + Math.floor(rand() * 24);
      const coords: number[] = [];
      const angles = Array.from({ length: n }, () => rand() * Math.PI * 2).sort((a, b) => a - b);
      for (const a of angles) coords.push(100 * Math.cos(a), 30 * Math.sin(a));
      const tris = refineTriangulation(coords, earcut(coords));
      expect(illegalEdges(coords, tris)).toBe(0);
    }
  });
});
