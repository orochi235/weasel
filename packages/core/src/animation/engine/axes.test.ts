import { describe, expect, it } from 'vitest';
import { axesOf } from './axes';

describe('axesOf', () => {
  it('reads a number as one axis', () => {
    const a = axesOf(3)!;
    expect(a.count).toBe(1);
    expect(a.to(3)).toEqual([3]);
    expect(a.from([4])).toBe(4);
  });

  it('reads a number array as one axis per entry', () => {
    const a = axesOf([1, 2, 3])!;
    expect(a.count).toBe(3);
    expect(a.from([4, 5, 6])).toEqual([4, 5, 6]);
  });

  it('reads an object of numeric fields in key order, and rebuilds it', () => {
    const a = axesOf({ y: 2, x: 1 })!;
    expect(a.count).toBe(2);
    expect(a.to({ x: 1, y: 2 })).toEqual([1, 2]);
    expect(a.from([5, 6])).toEqual({ x: 5, y: 6 });
  });

  it('returns null for anything else', () => {
    expect(axesOf({ x: 1, label: 'a' })).toBeNull();
    expect(axesOf({ x: { y: 1 } })).toBeNull();
    expect(axesOf('a')).toBeNull();
    expect(axesOf(null)).toBeNull();
  });
});
