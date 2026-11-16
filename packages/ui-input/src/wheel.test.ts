import { describe, expect, it } from 'vitest';
import { WHEEL_LINE_PX, wheelPixels } from './wheel';

describe('wheelPixels', () => {
  const page = { x: 300, y: 200 };
  it('keeps pixel deltas', () => {
    expect(wheelPixels({ deltaX: 3, deltaY: -5, deltaMode: 0 }, page)).toEqual({ x: 3, y: -5 });
  });
  it('counts a line as a line height', () => {
    expect(wheelPixels({ deltaX: 0, deltaY: 3, deltaMode: 1 }, page)).toEqual({ x: 0, y: 3 * WHEEL_LINE_PX });
  });
  it('counts a page as the page along each axis', () => {
    expect(wheelPixels({ deltaX: 1, deltaY: -1, deltaMode: 2 }, page)).toEqual({ x: 300, y: -200 });
  });
});
