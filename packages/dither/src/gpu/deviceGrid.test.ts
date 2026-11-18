import { describe, expect, it } from 'vitest';
import { deviceGrid } from './deviceGrid';

describe('deviceGrid', () => {
  const grid = { pitch: 0.4, origin: { x: 10, y: 20 } };

  it('is the grid in device pixels from the drawing buffer’s top left', () => {
    const view = { x: 5, y: 15, scale: { x: 10, y: 10 } };
    const g = deviceGrid(grid, view, 2);
    expect(g.pitch[0]).toBeCloseTo(8);
    expect(g.pitch[1]).toBeCloseTo(8);
    expect(g.origin).toEqual([100, 100]);
  });

  it('keeps the axes apart under a non-uniform scale', () => {
    const g = deviceGrid(grid, { x: 0, y: 0, scale: { x: 1, y: 2 } }, 1);
    expect(g.pitch[0]).toBeCloseTo(0.4);
    expect(g.pitch[1]).toBeCloseTo(0.8);
  });

  it('gives a flipped axis a negative pitch, from the same origin', () => {
    const g = deviceGrid(grid, { x: 0, y: 100, scale: { x: 1, y: -2 } }, 1);
    expect(g.pitch[0]).toBeCloseTo(0.4);
    expect(g.pitch[1]).toBeCloseTo(-0.8);
    expect(g.origin).toEqual([10, 160]);
  });
});
