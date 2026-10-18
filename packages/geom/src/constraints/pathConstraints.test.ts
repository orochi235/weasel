import { describe, expect, it } from 'vitest';
import { PathBuilder, polygonFromPoints } from '../paths/builder';
import { deleteAnchorsAt, insertAnchorOnSegment, moveHandleTo, translateAnchorBy } from '../paths/anchorEdits';
import { editAnchorSetTracked } from '../paths/anchorOrigins';
import { pathToAnchors } from '../paths/anchors';
import type { PolygonPath } from '../path';
import {
  constrainPathEdit, pathAnchorPoints, remapConstraints, anchorsBefore, segmentBetween, solvePathConstraints,
} from './pathConstraints';
import type { PathConstraint } from './types';

const PARALLELOGRAM: PathConstraint[] = [
  { kind: 'parallel', segments: [[0, 1], [3, 2]] },
  { kind: 'parallel', segments: [[1, 2], [0, 3]] },
];

const square = () => polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]) as PolygonPath;

function drag(path: PolygonPath, anchor: number, dx: number, dy: number) {
  return editAnchorSetTracked(path, (set) => {
    translateAnchorBy(set, anchor, dx, dy);
  })!;
}

const crossOf = (p: { x: number; y: number }[], [a, b]: readonly number[], [c, d]: readonly number[]) =>
  (p[b].x - p[a].x) * (p[d].y - p[c].y) - (p[b].y - p[a].y) * (p[d].x - p[c].x);

describe('solvePathConstraints', () => {
  it('carries a moved anchor’s handles with it', () => {
    const path = new PathBuilder().moveTo(0, 0).curveTo(20, -20, 80, 30, 100, 10).build() as PolygonPath;
    const r = solvePathConstraints(path, [{ kind: 'horizontal', segment: [0, 1] }], { held: [0] });
    expect(r.converged).toBe(true);
    const [a, b] = pathToAnchors(r.path).anchors[0];
    expect(b.y).toBeCloseTo(0, 3);
    expect(b.inHandle!.y).toBeCloseTo(20, 3);
    expect(a.outHandle).toEqual({ x: 20, y: -20 });
  });

  it('returns the same path when nothing moves', () => {
    const path = square();
    expect(solvePathConstraints(path, PARALLELOGRAM).path).toBe(path);
  });
});

describe('constrainPathEdit', () => {
  it('keeps a parallelogram one under a corner drag, the corner under the pointer', () => {
    const before = square();
    const edit = drag(before, 2, 40, 10);
    const r = constrainPathEdit(before, edit.path, PARALLELOGRAM, { origins: edit.origins });
    expect(r.converged).toBe(true);
    const pts = pathAnchorPoints(r.path);
    expect(Math.abs(crossOf(pts, [0, 1], [3, 2]))).toBeLessThan(0.05);
    expect(Math.abs(crossOf(pts, [1, 2], [0, 3]))).toBeLessThan(0.05);
    expect(Math.hypot(pts[2].x - 140, pts[2].y - 110)).toBeLessThan(1);
  });

  it('holds a fixed anchor where it was, even when the edit dragged it', () => {
    const before = square();
    const constraints: PathConstraint[] = [{ kind: 'fixed', anchor: 0 }, { kind: 'horizontal', segment: [0, 1] }];
    const edit = drag(before, 0, 25, 25);
    const r = constrainPathEdit(before, edit.path, constraints, { origins: edit.origins });
    expect(r.converged).toBe(true);
    const pts = pathAnchorPoints(r.path);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1].y).toBeCloseTo(0, 3);
  });

  it('leaves a constraint that already conflicted out of the solve, and reports it', () => {
    const before = square();
    // Segment 0→1 is horizontal, so `vertical` on it cannot hold alongside.
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'vertical', segment: [0, 1] },
    ];
    const edit = drag(before, 1, 0, 30);
    const r = constrainPathEdit(before, edit.path, constraints, { origins: edit.origins });
    expect(r.converged).toBe(true);
    expect(r.unsatisfied).toEqual([1]);
    const pts = pathAnchorPoints(r.path);
    expect(pts[0].y).toBeCloseTo(pts[1].y, 3);
  });

  it('renumbers constraints through a delete and drops the ones on the deleted anchor', () => {
    const before = polygonFromPoints([
      { x: 0, y: 0 }, { x: 50, y: -20 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
    ]) as PolygonPath;
    const edit = editAnchorSetTracked(before, (set) => deleteAnchorsAt(set, [1]))!;
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [3, 4] },
      { kind: 'length', segment: [0, 1], length: 10 },
    ];
    const r = constrainPathEdit(before, edit.path, constraints, { origins: edit.origins });
    expect(r.constraints).toEqual([{ kind: 'horizontal', segment: [2, 3] }]);
  });

  it('turns the other handle of a tangent anchor when one is dragged, and leaves the dragged one', () => {
    const before = new PathBuilder().moveTo(0, 0).curveTo(20, -20, 60, -20, 80, 0).curveTo(100, 20, 140, 20, 160, 0)
      .build() as PolygonPath;
    const edit = editAnchorSetTracked(before, (set) => {
      moveHandleTo(set, 1, 'out', 100, 40, true);
    })!;
    const r = constrainPathEdit(before, edit.path, [{ kind: 'tangent', anchor: 1 }], { origins: edit.origins });
    expect(r.converged).toBe(true);
    const [, a] = pathToAnchors(r.path).anchors[0];
    expect(a.outHandle).toEqual({ x: 100, y: 40 });
    const p = { x: a.inHandle!.x - 80, y: a.inHandle!.y };
    const q = { x: 20, y: 40 };
    expect(Math.abs(p.x * q.y - p.y * q.x) / Math.hypot(p.x, p.y)).toBeLessThan(1e-3);
    expect(p.x * q.x + p.y * q.y).toBeLessThan(0);
    expect({ x: a.x, y: a.y }).toEqual({ x: 80, y: 0 });
  });

  it('drops every constraint when the anchors renumber and nothing says how', () => {
    const before = square();
    const after = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]) as PolygonPath;
    expect(constrainPathEdit(before, after, PARALLELOGRAM).constraints).toEqual([]);
  });
});

describe('onPath through an edit', () => {
  // Anchor 3 is a tab off the square's top edge, which runs from anchor 2 to anchor 4.
  const tabbed = () => polygonFromPoints([
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 40, y: 120 }, { x: 0, y: 100 },
  ]) as PolygonPath;
  const ON: PathConstraint[] = [{ kind: 'onPath', anchor: 1, segment: [0, 4] }];

  it('slides the dragged anchor along its segment, leaving the segment where it was', () => {
    const before = polygonFromPoints([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 40, y: 0 },
    ]) as PolygonPath;
    const constraints: PathConstraint[] = [{ kind: 'onPath', anchor: 4, segment: [0, 1] }];
    const edit = drag(before, 4, 10, 30);
    const r = constrainPathEdit(before, edit.path, constraints, { origins: edit.origins });
    expect(r.converged).toBe(true);
    const pts = pathAnchorPoints(r.path);
    expect(pts[4].x).toBeCloseTo(50, 1);
    expect(pts[4].y).toBeCloseTo(pts[0].y + (pts[1].y - pts[0].y) * (pts[4].x / 100), 3);
    expect(Math.abs(pts[0].y)).toBeLessThan(0.1);
    expect(Math.abs(pts[1].y)).toBeLessThan(0.1);
  });

  it('drops an onPath whose segment an inserted anchor split', () => {
    const before = tabbed();
    const edit = editAnchorSetTracked(before, (set) => {
      insertAnchorOnSegment(set, { sub: 0, segIdx: 4, t: 0.5 });
    })!;
    const r = constrainPathEdit(before, edit.path, ON, { origins: edit.origins });
    expect(r.constraints).toEqual([]);
  });
});

describe('segmentBetween', () => {
  it('orders a pair as the path runs it, closing segment included', () => {
    const path = square();
    expect(segmentBetween(path, 2, 1)).toEqual([1, 2]);
    expect(segmentBetween(path, 0, 3)).toEqual([3, 0]);
    expect(segmentBetween(path, 0, 2)).toBeNull();
  });
});

describe('remapConstraints', () => {
  it('maps each constraint through the anchors it names', () => {
    const before = square();
    const wasAnchor = anchorsBefore(before, before, Array.from({ length: before.coords.length / 2 }, (_, a) => ({ a, b: a, t: 0 })));
    expect(wasAnchor).toEqual([0, 1, 2, 3]);
    expect(remapConstraints(PARALLELOGRAM, [undefined, 0, 1, 2, 3]).constraints).toEqual([
      { kind: 'parallel', segments: [[1, 2], [4, 3]] },
      { kind: 'parallel', segments: [[2, 3], [1, 4]] },
    ]);
  });
});
