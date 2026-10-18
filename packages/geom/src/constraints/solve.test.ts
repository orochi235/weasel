import { describe, expect, it } from 'vitest';
import { unsatisfiedConstraints } from './check';
import type { ConstraintPoint } from './points';
import { solveConstraints } from './solve';
import { nearestOnCubic } from '../nearest';
import type { PathConstraint } from './types';

const P = (x: number, y: number): ConstraintPoint => ({ x, y });
const cross = (a: ConstraintPoint, b: ConstraintPoint, c: ConstraintPoint, d: ConstraintPoint) =>
  (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
const dot = (a: ConstraintPoint, b: ConstraintPoint, c: ConstraintPoint, d: ConstraintPoint) =>
  (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y);
const dist = (a: ConstraintPoint, b: ConstraintPoint) => Math.hypot(b.x - a.x, b.y - a.y);

describe('solveConstraints', () => {
  it('levels a horizontal segment by moving both ends the least', () => {
    const r = solveConstraints([P(0, 0), P(100, 10)], [{ kind: 'horizontal', segment: [0, 1] }]);
    expect(r.converged).toBe(true);
    expect(r.points[0].y).toBeCloseTo(5, 6);
    expect(r.points[1].y).toBeCloseTo(5, 6);
    expect(r.points[0].x).toBeCloseTo(0, 6);
  });

  it('moves the free end and leaves a held one where the edit put it', () => {
    const r = solveConstraints([P(0, 0), P(100, 10)], [{ kind: 'horizontal', segment: [0, 1] }], { held: [1] });
    expect(r.points[1].y).toBeCloseTo(10, 1);
    expect(r.points[0].y).toBeCloseTo(r.points[1].y, 6);
  });

  it('moves a held anchor only as far as the constraints force it', () => {
    const constraints: PathConstraint[] = [{ kind: 'fixed', anchor: 0 }, { kind: 'length', segment: [0, 1], length: 100 }];
    const r = solveConstraints([P(0, 0), P(150, 0)], constraints, { held: [1] });
    expect(r.converged).toBe(true);
    expect(r.points[1].x).toBeCloseTo(100, 4);
    expect(r.points[1].y).toBeCloseTo(0, 4);
  });

  it('reads horizontal and vertical in the frame it is given', () => {
    const r = solveConstraints([P(0, 0), P(10, 100)], [{ kind: 'horizontal', segment: [0, 1] }], { axisAngle: Math.PI / 2 });
    expect(r.converged).toBe(true);
    expect(r.points[0].x).toBeCloseTo(r.points[1].x, 6);
  });

  it('puts a fixed anchor back where it was and solves around it', () => {
    const constraints: PathConstraint[] = [{ kind: 'fixed', anchor: 0 }, { kind: 'vertical', segment: [0, 1] }];
    const r = solveConstraints([P(30, 30), P(10, 100)], constraints, { reference: [P(0, 0), P(10, 100)] });
    expect(r.converged).toBe(true);
    expect(r.points[0]).toEqual({ x: 0, y: 0 });
    expect(r.points[1].x).toBeCloseTo(0, 6);
  });

  it('makes segments parallel, perpendicular, and equal in length', () => {
    const pts = [P(0, 0), P(100, 0), P(10, 50), P(90, 80)];
    const parallel = solveConstraints(pts, [{ kind: 'parallel', segments: [[0, 1], [2, 3]] }]);
    expect(Math.abs(cross(...parallel.points as [ConstraintPoint, ConstraintPoint, ConstraintPoint, ConstraintPoint]))).toBeLessThan(1e-4);
    const perpendicular = solveConstraints(pts.slice(0, 3), [{ kind: 'perpendicular', segments: [[0, 1], [1, 2]] }]);
    const [a, b, c] = perpendicular.points;
    expect(Math.abs(dot(a, b, b, c))).toBeLessThan(1e-4);
    const equal = solveConstraints(pts, [{ kind: 'equalLength', segments: [[0, 1], [2, 3]] }]);
    expect(dist(equal.points[0], equal.points[1])).toBeCloseTo(dist(equal.points[2], equal.points[3]), 5);
  });

  it('sets a length and joins coincident anchors', () => {
    const length = solveConstraints([P(0, 0), P(30, 40)], [{ kind: 'length', segment: [0, 1], length: 100 }]);
    expect(dist(length.points[0], length.points[1])).toBeCloseTo(100, 5);
    const joined = solveConstraints([P(0, 0), P(10, 20)], [{ kind: 'coincident', anchors: [0, 1] }]);
    expect(joined.points[0].x).toBeCloseTo(5, 6);
    expect(joined.points[1].y).toBeCloseTo(10, 6);
  });

  it('keeps a parallelogram one when a corner is dragged', () => {
    // 0 → 1 → 2 → 3, with corner 2 dragged up and out.
    const pts = [P(0, 0), P(100, 0), P(160, 110), P(40, 80)];
    const constraints: PathConstraint[] = [
      { kind: 'parallel', segments: [[0, 1], [3, 2]] },
      { kind: 'parallel', segments: [[1, 2], [0, 3]] },
    ];
    const r = solveConstraints(pts, constraints, { held: [2] });
    expect(r.converged).toBe(true);
    const [a, b, c, d] = r.points;
    expect(Math.abs(cross(a, b, d, c))).toBeLessThan(1e-3);
    expect(Math.abs(cross(b, c, a, d))).toBeLessThan(1e-3);
    expect(dist(c, pts[2])).toBeLessThan(1e-6);
  });

  it('solves a redundant but consistent set', () => {
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'horizontal', segment: [1, 2] },
      { kind: 'horizontal', segment: [0, 2] },
    ];
    const r = solveConstraints([P(0, 0), P(50, 7), P(100, -3)], constraints);
    expect(r.converged).toBe(true);
    expect(r.unsatisfied).toEqual([]);
  });

  it('reports a set that cannot all hold instead of claiming it does', () => {
    const constraints: PathConstraint[] = [
      { kind: 'fixed', anchor: 0 },
      { kind: 'fixed', anchor: 1 },
      { kind: 'length', segment: [0, 1], length: 50 },
    ];
    const r = solveConstraints([P(0, 0), P(100, 0)], constraints);
    expect(r.converged).toBe(false);
    expect(r.unsatisfied).toEqual([2]);
    expect(r.points).toEqual([P(0, 0), P(100, 0)]);
  });

  it('reports a set it could satisfy only by collapsing a segment to a point', () => {
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'vertical', segment: [0, 1] },
    ];
    const r = solveConstraints([P(0, 0), P(100, 10)], constraints);
    expect(r.converged).toBe(false);
    expect(r.unsatisfied).toEqual([0, 1]);
  });

  it('lets a pair meant to meet meet', () => {
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'coincident', anchors: [1, 0] },
    ];
    expect(solveConstraints([P(0, 0), P(100, 10)], constraints).converged).toBe(true);
  });

  it('leaves skipped constraints out of the solve but still reports them', () => {
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'vertical', segment: [0, 1] },
    ];
    const r = solveConstraints([P(0, 0), P(100, 10)], constraints, { skip: [1] });
    expect(r.converged).toBe(true);
    expect(r.unsatisfied).toEqual([1]);
  });
});

describe('tangent constraints', () => {
  /** An anchor at the origin with handles that meet at a corner. */
  const corner = (): ConstraintPoint => ({ x: 0, y: 0, inHandle: { x: -30, y: 10 }, outHandle: { x: 40, y: 15 } });
  const angleOf = (a: ConstraintPoint) => {
    const p = { x: a.inHandle!.x - a.x, y: a.inHandle!.y - a.y };
    const q = { x: a.outHandle!.x - a.x, y: a.outHandle!.y - a.y };
    return Math.atan2(p.x * q.y - p.y * q.x, p.x * q.x + p.y * q.y);
  };

  it('turns both handles of an anchor onto one line through it, their lengths left near what they were', () => {
    const r = solveConstraints([corner()], [{ kind: 'tangent', anchor: 0 }]);
    expect(r.converged).toBe(true);
    const [a] = r.points;
    expect(Math.abs(Math.abs(angleOf(a)) - Math.PI)).toBeLessThan(1e-5);
    expect(Math.hypot(a.inHandle!.x, a.inHandle!.y) / Math.hypot(30, 10)).toBeCloseTo(1, 0);
    expect(Math.hypot(a.outHandle!.x, a.outHandle!.y) / Math.hypot(40, 15)).toBeCloseTo(1, 0);
    expect(a.x).toBe(0);
  });

  it('turns only the free handle when the other is held', () => {
    const r = solveConstraints([corner()], [{ kind: 'tangent', anchor: 0 }], { heldHandles: [{ anchor: 0, side: 'out' }] });
    expect(r.converged).toBe(true);
    const [a] = r.points;
    expect(a.outHandle).toEqual({ x: 40, y: 15 });
    expect(Math.abs(Math.abs(angleOf(a)) - Math.PI)).toBeLessThan(1e-5);
  });

  it('carries the handles with an anchor another constraint moves', () => {
    const points = [corner(), P(100, 20)];
    const r = solveConstraints(points, [{ kind: 'tangent', anchor: 0 }, { kind: 'horizontal', segment: [0, 1] }], { held: [1] });
    expect(r.converged).toBe(true);
    const [a] = r.points;
    expect(a.y).toBeCloseTo(20, 4);
    expect(Math.abs(Math.abs(angleOf(a)) - Math.PI)).toBeLessThan(1e-5);
  });

  it('cannot hold on an anchor missing a handle', () => {
    const r = solveConstraints([{ x: 0, y: 0, outHandle: { x: 10, y: 0 } }], [{ kind: 'tangent', anchor: 0 }]);
    expect(r.converged).toBe(false);
    expect(r.unsatisfied).toEqual([0]);
  });

  it('is unsatisfied while the handles meet at a corner', () => {
    expect(unsatisfiedConstraints([corner()], [{ kind: 'tangent', anchor: 0 }])).toEqual([0]);
    const smooth = { x: 0, y: 0, inHandle: { x: -30, y: -15 }, outHandle: { x: 20, y: 10 } };
    expect(unsatisfiedConstraints([smooth], [{ kind: 'tangent', anchor: 0 }])).toEqual([]);
  });
});

describe('onPath constraints', () => {
  /** A curved segment from anchor 1 to anchor 2, and anchor 0 off it. */
  const curve = (): ConstraintPoint[] => [
    P(40, 30),
    { x: 0, y: 0, outHandle: { x: 30, y: -40 } },
    { x: 100, y: 0, inHandle: { x: 70, y: -40 } },
  ];
  const offCurve = (pts: ConstraintPoint[]) => {
    const [p, a, b] = pts;
    return nearestOnCubic(p.x, p.y, a.x, a.y, a.outHandle!.x, a.outHandle!.y, b.inHandle!.x, b.inHandle!.y, b.x, b.y).dist;
  };
  const ON: PathConstraint = { kind: 'onPath', anchor: 0, segment: [1, 2] };
  const ENDS: PathConstraint[] = [{ kind: 'fixed', anchor: 1 }, { kind: 'fixed', anchor: 2 }];

  it('puts an anchor on a curved segment', () => {
    const r = solveConstraints(curve(), [ON, ...ENDS]);
    expect(r.converged).toBe(true);
    expect(offCurve(r.points)).toBeLessThan(1e-4);
    expect(r.points[1]).toEqual(curve()[1]);
  });

  it('slides a held anchor onto the segment rather than moving the segment to it', () => {
    const r = solveConstraints(curve(), [ON], { held: [0] });
    expect(r.converged).toBe(true);
    expect(offCurve(r.points)).toBeLessThan(1e-4);
    expect(dist(r.points[1], P(0, 0))).toBeLessThan(0.5);
    expect(dist(r.points[2], P(100, 0))).toBeLessThan(0.5);
  });

  it('stops an anchor at the end of its segment', () => {
    const pts = curve();
    pts[0] = P(160, 10);
    const r = solveConstraints(pts, [ON, ...ENDS]);
    expect(r.converged).toBe(true);
    expect(dist(r.points[0], P(100, 0))).toBeLessThan(1e-4);
  });

  it('reads a segment with no handles as the straight line between its ends', () => {
    const r = solveConstraints([P(40, 30), P(0, 0), P(100, 0)], [ON, ...ENDS]);
    expect(r.points[0].x).toBeCloseTo(40, 4);
    expect(r.points[0].y).toBeCloseTo(0, 4);
  });

  it('is unsatisfied off its segment and satisfied on it', () => {
    expect(unsatisfiedConstraints(curve(), [ON])).toEqual([0]);
    const on = curve();
    on[0] = P(50, -30);
    expect(unsatisfiedConstraints(on, [ON])).toEqual([]);
  });
});

describe('unsatisfiedConstraints', () => {
  it('flags a constraint naming an anchor the points do not have', () => {
    expect(unsatisfiedConstraints([P(0, 0)], [{ kind: 'horizontal', segment: [0, 3] }])).toEqual([0]);
  });

  it('flags a fixed anchor away from its reference', () => {
    const c: PathConstraint[] = [{ kind: 'fixed', anchor: 0 }];
    expect(unsatisfiedConstraints([P(5, 0)], c, { reference: [P(0, 0)] })).toEqual([0]);
    expect(unsatisfiedConstraints([P(5, 0)], c)).toEqual([]);
  });
});
