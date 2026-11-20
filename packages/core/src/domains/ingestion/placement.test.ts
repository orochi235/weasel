import { describe, expect, it } from 'vitest';
import { arrivalBounds } from './placement';
import { worldPerPxOf } from 'core/viewport/viewportWorldRect';

const SIZE = { width: 10, height: 10 };
const at = (scale: { x: number; y: number }) => ({
  point: { x: 0, y: 0 },
  viewportWorldRect: () => ({ x: 0, y: 0, width: 100, height: 100 }),
  worldPerPx: () => worldPerPxOf({ x: 0, y: 0, scale }),
});

describe('arrivalBounds', () => {
  it('steps each item of an arrival 24 screen px down and right, at any zoom', () => {
    expect(arrivalBounds(at({ x: 1, y: 1 }), SIZE, 1)).toEqual({ x: 19, y: 19, width: 10, height: 10 });
    expect(arrivalBounds(at({ x: 4, y: 4 }), SIZE, 2)).toEqual({ x: 7, y: 7, width: 10, height: 10 });
    expect(arrivalBounds(at({ x: 0.5, y: 0.5 }), SIZE, 1)).toEqual({ x: 43, y: 43, width: 10, height: 10 });
  });

  it('steps down on screen on a flipped y axis', () => {
    expect(arrivalBounds(at({ x: 1, y: -1 }), SIZE, 1)).toEqual({ x: 19, y: -29, width: 10, height: 10 });
  });

  it('reads a CSS px as a world unit with no worldPerPx', () => {
    const ctx = { point: null, viewportWorldRect: () => ({ x: 0, y: 0, width: 100, height: 100 }) };
    expect(arrivalBounds(ctx, SIZE, 1)).toEqual({ x: 69, y: 69, width: 10, height: 10 });
  });
});
