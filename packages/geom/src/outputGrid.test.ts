import { describe, expect, it } from 'vitest';
import { alignToGrid, snapToPitch } from './outputGrid';

describe('snapToPitch', () => {
  it('rounds to the nearest whole dot, half a dot up', () => {
    expect(snapToPitch(1.1, 0.4)).toBeCloseTo(1.2, 12);
    expect(snapToPitch(0.95, 0.4)).toBeCloseTo(0.8, 12);
    expect(snapToPitch(1.0, 0.4)).toBeCloseTo(1.2, 12);
  });

  it('keeps one dot for anything thinner, a zero included', () => {
    expect(snapToPitch(0.1, 0.4)).toBe(0.4);
    expect(snapToPitch(0, 0.4)).toBe(0.4);
  });

  it('gives its own output back unchanged', () => {
    for (const v of [0.55, 1.37, 41.25, 60.01]) {
      const once = snapToPitch(v, 72 / 300);
      expect(snapToPitch(once, 72 / 300)).toBe(once);
    }
  });
});

describe('alignToGrid', () => {
  it('moves the corner to the nearest grid corner against an origin off zero, and keeps the rest', () => {
    const grid = { pitch: 0.4, origin: { x: 0.1, y: -0.15 } };
    const out = alignToGrid({ x: 3.02, y: 7.3, width: 2.2, height: 1, rotation: 0 }, grid);
    expect((out.x - 0.1) / 0.4).toBeCloseTo(7, 9);
    expect((out.y + 0.15) / 0.4).toBeCloseTo(19, 9);
    expect(out).toMatchObject({ width: 2.2, height: 1, rotation: 0 });
  });

  it('is idempotent', () => {
    const grid = { pitch: 72 / 180, origin: { x: 0, y: 3.3 } };
    const once = alignToGrid({ x: 192.13, y: 16.07 }, grid);
    expect(alignToGrid(once, grid)).toEqual(once);
  });
});
