import { describe, expect, it } from 'vitest';
import { gridOnScreen } from './gridOnScreen';

describe('gridOnScreen', () => {
  const grid = { pitch: 0.4, origin: { x: 10, y: 20 } };

  it('is the grid in device pixels from the drawing buffer’s top left', () => {
    const view = { x: 5, y: 15, scale: { x: 10, y: 10 } };
    const g = gridOnScreen(grid, view, 2);
    expect(g.pitch[0]).toBeCloseTo(8);
    expect(g.pitch[1]).toBeCloseTo(8);
    expect(g.origin).toEqual([100, 100]);
  });

  it('keeps the axes apart under a non-uniform scale', () => {
    const g = gridOnScreen(grid, { x: 0, y: 0, scale: { x: 1, y: 2 } }, 1);
    expect(g.pitch[0]).toBeCloseTo(0.4);
    expect(g.pitch[1]).toBeCloseTo(0.8);
  });
});
