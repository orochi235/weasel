/**
 * Hard puppet warps, and the measures of whether one folds: test fixtures for
 * the solver, not part of the package's surface.
 */
import type { PolygonPath } from '../path';
import { PathBuilder } from '../paths/builder';
import type { Point } from '../paths/cubicMath';
import type { ArapMesh } from './arap';
import type { PuppetPin } from './puppet';

/** A warp case: the shape, its pins, and its outline sampled with each sample's inward normal. */
export interface FoldCase {
  name: string;
  shape: PolygonPath;
  pins: PuppetPin[];
  outline: (count: number) => { p: Point; n: Point }[];
}

const K = 0.5522847498;

/** A disc 100 across, centered on (50, 50), as four cubics. */
function disc(): PolygonPath {
  const c = 50, r = 50, k = K * r;
  return new PathBuilder()
    .moveTo(c + r, c)
    .curveTo(c + r, c + k, c + k, c + r, c, c + r)
    .curveTo(c - k, c + r, c - r, c + k, c - r, c)
    .curveTo(c - r, c - k, c - k, c - r, c, c - r)
    .curveTo(c + k, c - r, c + r, c - k, c + r, c)
    .close().build();
}

const hold = (x: number, y: number): PuppetPin => ({ from: { x, y }, to: { x, y } });
const drag = (x: number, y: number, tx: number, ty: number): PuppetPin => ({ from: { x, y }, to: { x: tx, y: ty } });

export const discSquash: FoldCase = {
  name: 'disc squash',
  shape: disc(),
  pins: [hold(20, 50), drag(80, 50, 60, 70), drag(50, 20, 40, 30)],
  outline: (count) => Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { p: { x: 50 + 50 * Math.cos(a), y: 50 + 50 * Math.sin(a) }, n: { x: -Math.cos(a), y: -Math.sin(a) } };
  }),
};

/** A bar 200 by 20, its ends pushed together and its middle pushed both ways. */
export const barS: FoldCase = {
  name: 'bar S',
  shape: new PathBuilder().moveTo(0, 0).lineTo(200, 0).lineTo(200, 20).lineTo(0, 20).close().build(),
  pins: [drag(10, 10, 50, 10), drag(70, 10, 60, -40), drag(130, 10, 140, 60), drag(190, 10, 150, 10)],
  outline: (count) => {
    const per = 2 * (200 + 20);
    return Array.from({ length: count }, (_, i) => {
      let s = (i / count) * per;
      if (s < 200) return { p: { x: s, y: 0 }, n: { x: 0, y: 1 } };
      s -= 200;
      if (s < 20) return { p: { x: 200, y: s }, n: { x: -1, y: 0 } };
      s -= 20;
      if (s < 200) return { p: { x: 200 - s, y: 20 }, n: { x: 0, y: -1 } };
      s -= 200;
      return { p: { x: 0, y: 20 - s }, n: { x: 1, y: 0 } };
    });
  },
};

/** How many triangles of `mesh` placed at `at` have turned over against their rest orientation. */
export function invertedTriangles(mesh: ArapMesh, at: ArrayLike<number>): number {
  const V = mesh.vertices, T = mesh.triangles;
  const area = (P: ArrayLike<number>, t: number) => {
    const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
    return (P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * b + 1] - P[2 * a + 1]) * (P[2 * c] - P[2 * a]);
  };
  let count = 0;
  for (let t = 0; t < T.length / 3; t++) if (area(at, t) * Math.sign(area(V, t)) <= 0) count++;
  return count;
}

/** How many runs of the outline come out with the fill on the wrong side of them under `map`. */
export function backwardStretches(c: FoldCase, map: (p: Point) => Point, count = 2000, eps = 0.05): number {
  const s = c.outline(count);
  const flipped = s.map(({ p, n }, i) => {
    const next = s[(i + 1) % count].p;
    const q = map(p), q1 = map(next), qi = map({ x: p.x + eps * n.x, y: p.y + eps * n.y });
    const rest = (next.x - p.x) * n.y - (next.y - p.y) * n.x;
    const now = (q1.x - q.x) * (qi.y - q.y) - (q1.y - q.y) * (qi.x - q.x);
    return rest * now <= 0;
  });
  let runs = 0;
  for (let i = 0; i < count; i++) if (flipped[i] && !flipped[(i + count - 1) % count]) runs++;
  return runs === 0 && flipped[0] ? 1 : runs;
}
