import { describe, it, expect } from 'vitest';
import { none, nearest, nearestWithin, cellAt } from './snaps';
import type { DropTarget } from './types';

type P = { x: number; y: number };

const target = (x: number, y: number, meta?: unknown): DropTarget<P> => ({
  pose: { x, y },
  origin: { x, y },
  meta,
});

describe('none', () => {
  it('returns null regardless of input', () => {
    const snap = none<P>();
    expect(snap.pickTarget([target(0, 0), target(10, 10)], { x: 5, y: 5 })).toBeNull();
    expect(snap.pickTarget([], { x: 0, y: 0 })).toBeNull();
  });
});

describe('nearest', () => {
  it('returns the closest target by Euclidean distance', () => {
    const snap = nearest<P>();
    const got = snap.pickTarget(
      [target(0, 0), target(10, 0), target(0, 10)],
      { x: 9, y: 1 },
    );
    expect(got?.origin).toEqual({ x: 10, y: 0 });
  });

  it('returns null when targets is empty', () => {
    expect(nearest<P>().pickTarget([], { x: 0, y: 0 })).toBeNull();
  });
});

describe('nearestWithin', () => {
  it('returns null when nothing is within tolerance', () => {
    const snap = nearestWithin<P>({ tolerance: 1 });
    expect(snap.pickTarget([target(0, 0)], { x: 5, y: 5 })).toBeNull();
  });

  it('returns the closest target within tolerance', () => {
    const snap = nearestWithin<P>({ tolerance: 5 });
    const got = snap.pickTarget(
      [target(0, 0), target(10, 0)],
      { x: 2, y: 0 },
    );
    expect(got?.origin).toEqual({ x: 0, y: 0 });
  });
});

describe('cellAt', () => {
  it('returns the target whose meta.cellRect contains the pointer', () => {
    const snap = cellAt<P>();
    const a = target(0, 0, { cellRect: { x: 0, y: 0, width: 10, height: 10 } });
    const b = target(20, 0, { cellRect: { x: 10, y: 0, width: 10, height: 10 } });
    expect(snap.pickTarget([a, b], { x: 12, y: 5 })?.origin).toEqual({ x: 20, y: 0 });
  });

  it('falls back to nearest when pointer is outside all cells', () => {
    const snap = cellAt<P>();
    const a = target(0, 0, { cellRect: { x: 0, y: 0, width: 10, height: 10 } });
    const b = target(20, 0, { cellRect: { x: 10, y: 0, width: 10, height: 10 } });
    expect(snap.pickTarget([a, b], { x: 100, y: 5 })?.origin).toEqual({ x: 20, y: 0 });
  });

  it('returns null when targets is empty', () => {
    expect(cellAt<P>().pickTarget([], { x: 0, y: 0 })).toBeNull();
  });
});
