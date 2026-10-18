import { describe, expect, it } from 'vitest';
import { conflictingConstraints } from './conflicts';
import type { ConstraintPoint } from './points';
import type { PathConstraint } from './types';

const P = (x: number, y: number): ConstraintPoint => ({ x, y });
/** A quadrilateral with no edge on an axis, so turning one onto an axis never has to collapse it. */
const QUAD = [P(0, 0), P(100, 30), P(110, 120), P(-10, 100)];

describe('conflictingConstraints', () => {
  it('is empty when every constraint can hold at once, held or not yet', () => {
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'length', segment: [0, 1], length: 60 },
    ];
    expect(conflictingConstraints(QUAD, constraints)).toEqual([]);
  });

  it('names every member of the conflict, not only the one left failing', () => {
    const constraints: PathConstraint[] = [
      { kind: 'fixed', anchor: 0 },
      { kind: 'fixed', anchor: 1 },
      { kind: 'horizontal', segment: [2, 3] },
      { kind: 'vertical', segment: [0, 1] },
    ];
    expect(conflictingConstraints(QUAD, constraints)).toEqual([0, 1, 3]);
  });

  it('leaves out a constraint the conflict does not need', () => {
    const constraints: PathConstraint[] = [
      { kind: 'parallel', segments: [[0, 1], [3, 2]] },
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'fixed', anchor: 0 },
      { kind: 'vertical', segment: [0, 1] },
    ];
    expect(conflictingConstraints(QUAD, constraints)).toEqual([1, 3]);
  });

  it('keeps the later of two constraints that conflict the same way with a third', () => {
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'vertical', segment: [0, 1] },
    ];
    expect(conflictingConstraints(QUAD, constraints)).toEqual([1, 2]);
  });

  it('finds one set in each group of constraints that shares no anchor with another', () => {
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'vertical', segment: [0, 1] },
      { kind: 'horizontal', segment: [2, 3] },
      { kind: 'vertical', segment: [2, 3] },
    ];
    expect(conflictingConstraints(QUAD, constraints)).toEqual([0, 1, 2, 3]);
  });

  it('names a constraint that cannot apply on its own', () => {
    const constraints: PathConstraint[] = [{ kind: 'tangent', anchor: 0 }, { kind: 'horizontal', segment: [0, 9] }];
    expect(conflictingConstraints(QUAD, constraints)).toEqual([0, 1]);
  });
});
