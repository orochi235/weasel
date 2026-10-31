import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { tessellate, type Mesh } from '@weasel-js/geom/tessellate';
import { tessellateStroke } from '@weasel-js/stroke';
import { cutToTriangles } from './triangleCut';

function triangles(mesh: Mesh): number[][] {
  const v = mesh.vertices, out: number[][] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [p, q, r] = [mesh.indices[i] * 2, mesh.indices[i + 1] * 2, mesh.indices[i + 2] * 2];
    out.push([v[p], v[p + 1], v[q], v[q + 1], v[r], v[r + 1]]);
  }
  return out;
}

const areaOf = (t: number[]) => Math.abs((t[2] - t[0]) * (t[5] - t[1]) - (t[4] - t[0]) * (t[3] - t[1])) / 2;
const area = (mesh: Mesh) => triangles(mesh).reduce((a, t) => a + areaOf(t), 0);

/** Whether `(x, y)` is inside one of `fill`'s triangles. */
function inside(fill: Mesh, x: number, y: number): boolean {
  return triangles(fill).some((t) => {
    const s = (ax: number, ay: number, bx: number, by: number) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    const d0 = s(t[0], t[1], t[2], t[3]), d1 = s(t[2], t[3], t[4], t[5]), d2 = s(t[4], t[5], t[0], t[1]);
    return (d0 >= 0 && d1 >= 0 && d2 >= 0) || (d0 <= 0 && d1 <= 0 && d2 <= 0);
  });
}

/** Each piece's centroid on the side it was cut to, for every piece with area enough to have one. */
function onItsSide(cut: Mesh, fill: Mesh, inner: boolean): boolean {
  return triangles(cut).filter((t) => areaOf(t) > 1e-3)
    .every((t) => inside(fill, (t[0] + t[2] + t[4]) / 3, (t[1] + t[3] + t[5]) / 3) === inner);
}

const doubled = (d: string) => tessellateStroke(pathFromD(d), { width: 20, join: 'miter', miterLimit: 10 });

const SHAPES: [string, string][] = [
  ['a notched square', 'M 0 0 L 100 0 L 100 100 L 50 50 L 0 100 Z'],
  ['a square with a hole', 'M 0 0 L 100 0 L 100 100 L 0 100 Z M 30 30 L 30 70 L 70 70 L 70 30 Z'],
  ['a star', 'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z'],
  ['a curved crescent', 'M 50 0 C 90 0 100 40 100 50 C 100 90 60 100 50 100 C 80 80 80 20 50 0 Z'],
];

describe('cutToTriangles', () => {
  it('cuts a square as its outline does', () => {
    const ribbon = doubled('M 0 0 L 100 0 L 100 100 L 0 100 Z');
    const fill = tessellate(pathFromD('M 0 0 L 100 0 L 100 100 L 0 100 Z'));
    expect(area(cutToTriangles(ribbon, fill, true)!)).toBeCloseTo(100 * 100 - 80 * 80, 3);
    expect(area(cutToTriangles(ribbon, fill, false)!)).toBeCloseTo(120 * 120 - 100 * 100, 3);
  });

  for (const [name, d] of SHAPES) {
    it(`splits the ribbon of ${name} into its two sides`, () => {
      const ribbon = doubled(d);
      const fill = tessellate(pathFromD(d));
      const inner = cutToTriangles(ribbon, fill, true)!;
      const outer = cutToTriangles(ribbon, fill, false)!;
      expect(area(inner)).toBeGreaterThan(0);
      expect(area(outer)).toBeGreaterThan(0);
      expect(area(inner) + area(outer)).toBeCloseTo(area(ribbon), 2);
      expect(onItsSide(inner, fill, true)).toBe(true);
      expect(onItsSide(outer, fill, false)).toBe(true);
    });
  }

  it('gives up past its budget', () => {
    const d = SHAPES[2][1];
    expect(cutToTriangles(doubled(d), tessellate(pathFromD(d)), false, 10)).toBeNull();
    expect(cutToTriangles(doubled(d), tessellate(pathFromD(d)), true, 10)).toBeNull();
  });

  it('measures the fill from its own origin', () => {
    const d = 'M 1000 1000 L 1100 1000 L 1100 1100 L 1050 1050 L 1000 1100 Z';
    const at = { x: 1000, y: 1000 };
    const shift = (m: Mesh, o: { x: number; y: number }): Mesh => {
      const v = Float32Array.from(m.vertices, (x, i) => x - (i % 2 ? o.y : o.x));
      return { ...m, vertices: v, origin: o };
    };
    const ribbon = doubled(d);
    const fill = tessellate(pathFromD(d));
    const plain = area(cutToTriangles(ribbon, fill, true)!);
    expect(area(cutToTriangles(ribbon, shift(fill, at), true)!)).toBeCloseTo(plain, 2);
    expect(area(cutToTriangles(shift(ribbon, { x: 990, y: 1010 }), shift(fill, at), true)!)).toBeCloseTo(plain, 2);
  });
});
