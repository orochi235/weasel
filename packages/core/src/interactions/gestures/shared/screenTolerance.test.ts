import { describe, it, expect } from 'vitest';
import { screenTolerance } from './screenTolerance';
import type { View } from 'core/viewport/view';

const view = { x: 0, y: 0, scale: { x: 2, y: 4 } } as unknown as View;

describe('screenTolerance', () => {
  it('reads a pixel through the camera', () => {
    expect(screenTolerance(8, { view })).toEqual({ x: 4, y: 2 });
  });

  it("carries the camera's tolerance into the gesture's parallax plane", () => {
    const plane = { scale: { x: 3, y: 0.5 }, offset: { x: 10, y: 10 } };
    expect(screenTolerance(8, { view, plane })).toEqual({ x: 12, y: 1 });
  });

  it('is one unit per pixel with no view', () => {
    expect(screenTolerance(5, { view: null })).toEqual({ x: 5, y: 5 });
  });
});
