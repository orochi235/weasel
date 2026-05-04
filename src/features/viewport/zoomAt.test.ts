import { describe, it, expect } from 'vitest';
import { zoomAt } from './zoomAt';

describe('zoomAt', () => {
  it('keeps the world point under the anchor invariant', () => {
    const view = { x: 10, y: 10, scale: 1 };
    const anchor = { x: 100, y: 50 }; // screen coords
    // World point under anchor: (100/1 + 10, 50/1 + 10) = (110, 60)
    const next = zoomAt(view, anchor, 2);
    expect(next.scale).toBe(2);
    // Same anchor must still resolve to (110, 60)
    expect(anchor.x / next.scale + next.x).toBeCloseTo(110);
    expect(anchor.y / next.scale + next.y).toBeCloseTo(60);
  });

  it('clamps to default min (0.1) and max (8)', () => {
    expect(zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 0.001).scale).toBe(0.1);
    expect(zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 100).scale).toBe(8);
  });

  it('respects custom min/max', () => {
    expect(
      zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 100, { min: 0.5, max: 2 }).scale,
    ).toBe(2);
  });

  it('factor=1 is identity (modulo float)', () => {
    const view = { x: 7, y: 3, scale: 1.5 };
    const next = zoomAt(view, { x: 50, y: 50 }, 1);
    expect(next.scale).toBeCloseTo(1.5);
    expect(next.x).toBeCloseTo(7);
    expect(next.y).toBeCloseTo(3);
  });
});
