import { describe, expect, it } from 'vitest';
import { arcInBox } from './arcInBox';

describe('arcInBox', () => {
  it('sizes an arc to the box\'s inscribed circle less its inset', () => {
    expect(arcInBox({ start: 240, end: 120, direction: 'ccw', inset: 12 }, { width: 200, height: 160 }))
      .toEqual({ center: { x: 100, y: 80 }, radius: 68, start: 240, end: 120, direction: 'ccw' });
  });

  it('lets an explicit radius and center win over the box', () => {
    expect(arcInBox({ start: 0, end: 90, radius: 40, center: { x: 5, y: 6 } }, { width: 200, height: 200 }))
      .toMatchObject({ center: { x: 5, y: 6 }, radius: 40 });
  });

  it('gives radius 0, never negative, for a box smaller than its inset', () => {
    expect(arcInBox({ start: 0, end: 90, inset: 30 }, { width: 40, height: 40 }).radius).toBe(0);
  });
});
