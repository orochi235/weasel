/**
 * The path constraint solve against anchor count: one drag frame of a
 * staircase whose every segment is horizontal or vertical, every fourth one a
 * set length, every pair of verticals six apart equal, its first anchor fixed
 * and its last one dragged. Every anchor starts a little out of true, so the
 * whole path is in play.
 *
 * `CONSTRAINT_BENCH_SIZES=50,200` picks the sizes; the default is 50, 200, and 1000.
 */
import { solveConstraints, type ConstraintPoint, type PathConstraint } from '@weasel-js/geom';
import { group } from './group';

const SIZES = (process.env.CONSTRAINT_BENCH_SIZES ?? '50,200,1000').split(',').map(Number);

function staircase(n: number): { points: ConstraintPoint[]; constraints: PathConstraint[] } {
  const points: ConstraintPoint[] = [];
  for (let i = 0; i < n; i++) {
    const wobble = Math.sin(i * 12.9898) * 2;
    points.push({ x: 20 * Math.ceil(i / 2) + wobble, y: 20 * Math.floor(i / 2) - wobble });
  }
  const constraints: PathConstraint[] = [{ kind: 'fixed', anchor: 0 }];
  for (let k = 0; k + 1 < n; k++) {
    constraints.push({ kind: k % 2 === 0 ? 'horizontal' : 'vertical', segment: [k, k + 1] });
    if (k % 4 === 0) constraints.push({ kind: 'length', segment: [k, k + 1], length: 20 });
    if (k % 2 === 1 && k + 7 < n) constraints.push({ kind: 'equalLength', segments: [[k, k + 1], [k + 6, k + 7]] });
  }
  points[n - 1] = { x: points[n - 1].x + 7, y: points[n - 1].y + 5 };
  return { points, constraints };
}

group('constraint solve — staircase drag frame', (bench) => {
  for (const n of SIZES) {
    const { points, constraints } = staircase(n);
    bench(`${n} anchors`, () => {
      solveConstraints(points, constraints, { held: [n - 1] });
    });
  }
}, { time: 0, iterations: 10, warmupTime: 0, warmupIterations: 2 });
