import { describe, it, expect } from 'vitest';
import { axisAlignedBounds, unionGestureBounds } from './gestureBounds';

describe('axisAlignedBounds', () => {
  it('returns an unrotated box unchanged (and without a rotation field)', () => {
    const b = axisAlignedBounds({ x: 5, y: 10, width: 20, height: 30 });
    expect(b).toEqual({ x: 5, y: 10, width: 20, height: 30 });
    expect('rotation' in b).toBe(false);
  });

  it('drops an explicit rotation of 0', () => {
    const b = axisAlignedBounds({ x: 0, y: 0, width: 4, height: 4, rotation: 0 });
    expect(b).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });

  it('expands a 45°-rotated square to its circumscribing AABB', () => {
    // 10×10 centered at (5,5); rotated 45° the half-diagonal is 5√2 ≈ 7.071.
    const b = axisAlignedBounds({ x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 4 });
    const half = (10 * Math.SQRT2) / 2;
    expect(b.x).toBeCloseTo(5 - half, 5);
    expect(b.y).toBeCloseTo(5 - half, 5);
    expect(b.width).toBeCloseTo(2 * half, 5);
    expect(b.height).toBeCloseTo(2 * half, 5);
  });

  it('swaps extents for a 90°-rotated rect, pivoting on the AABB center', () => {
    const b = axisAlignedBounds({ x: 0, y: 0, width: 40, height: 10, rotation: Math.PI / 2 });
    expect(b.width).toBeCloseTo(10, 5);
    expect(b.height).toBeCloseTo(40, 5);
    // Center is preserved: (20, 5).
    expect(b.x + b.width / 2).toBeCloseTo(20, 5);
    expect(b.y + b.height / 2).toBeCloseTo(5, 5);
  });
});

describe('unionGestureBounds', () => {
  it('returns null for an empty iterable', () => {
    expect(unionGestureBounds([])).toBeNull();
  });

  it('returns null when every part is null/undefined', () => {
    expect(unionGestureBounds([null, undefined, null])).toBeNull();
  });

  it('returns a single part as its own AABB', () => {
    expect(unionGestureBounds([{ x: 1, y: 2, width: 3, height: 4 }]))
      .toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it('unions disjoint parts into their envelope', () => {
    const u = unionGestureBounds([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 50, y: 20, width: 10, height: 10 },
    ]);
    expect(u).toEqual({ x: 0, y: 0, width: 60, height: 30 });
  });

  it('skips nulls interleaved with real parts', () => {
    const u = unionGestureBounds([
      null,
      { x: 0, y: 0, width: 10, height: 10 },
      undefined,
      { x: -5, y: -5, width: 1, height: 1 },
    ]);
    expect(u).toEqual({ x: -5, y: -5, width: 15, height: 15 });
  });

  it('folds rotated parts by their rotated extent, not their local box', () => {
    const u = unionGestureBounds([
      { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 4 },
    ])!;
    const half = (10 * Math.SQRT2) / 2;
    expect(u.width).toBeCloseTo(2 * half, 5);
  });

  it('never reports a rotation on the union', () => {
    const u = unionGestureBounds([
      { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 4 },
      { x: 100, y: 0, width: 10, height: 10, rotation: Math.PI / 4 },
    ])!;
    expect('rotation' in u).toBe(false);
  });
});
