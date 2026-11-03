import { describe, expect, it } from 'vitest';
import { viewportWorldRect } from './viewportWorldRect';

const SIZE = { width: 200, height: 100 };

describe('viewportWorldRect', () => {
  it('runs from the camera corner for a y-down view', () => {
    expect(viewportWorldRect({ x: 10, y: 20, scale: { x: 2, y: 4 } }, SIZE)).toEqual({ x: 10, y: 20, width: 100, height: 25 });
  });

  it('gives a y-up view a positive size, ending at the camera corner', () => {
    expect(viewportWorldRect({ x: 10, y: 20, scale: { x: 2, y: -4 } }, SIZE)).toEqual({ x: 10, y: -5, width: 100, height: 25 });
  });

  it('gives an x-flipped view a positive size, ending at the camera corner', () => {
    expect(viewportWorldRect({ x: 10, y: 20, scale: { x: -2, y: 4 } }, SIZE)).toEqual({ x: -90, y: 20, width: 100, height: 25 });
  });
});
