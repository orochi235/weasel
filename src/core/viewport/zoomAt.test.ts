import { describe, it, expect } from 'vitest';
import { zoomAt } from './zoomAt';

describe('zoomAt', () => {
  it('keeps the world point under the anchor invariant', () => {
    const view = { x: 10, y: 10, scale: { x: 1, y: 1 } };
    const anchor = { x: 100, y: 50 }; // screen coords
    // World point under anchor: (100/1 + 10, 50/1 + 10) = (110, 60)
    const next = zoomAt(view, anchor, 2);
    expect(next.scale.x).toBe(2);
    expect(next.scale.y).toBe(2);
    // Same anchor must still resolve to (110, 60)
    expect(anchor.x / next.scale.x + next.x).toBeCloseTo(110);
    expect(anchor.y / next.scale.y + next.y).toBeCloseTo(60);
  });

  it('clamps to default min (0.1) and max (8)', () => {
    expect(zoomAt({ x: 0, y: 0, scale: { x: 1, y: 1 } }, { x: 0, y: 0 }, 0.001).scale.x).toBe(0.1);
    expect(zoomAt({ x: 0, y: 0, scale: { x: 1, y: 1 } }, { x: 0, y: 0 }, 100).scale.x).toBe(8);
  });

  it('respects custom min/max', () => {
    expect(
      zoomAt({ x: 0, y: 0, scale: { x: 1, y: 1 } }, { x: 0, y: 0 }, 100, { min: 0.5, max: 2 }).scale.x,
    ).toBe(2);
  });

  it('factor=1 is identity (modulo float)', () => {
    const view = { x: 7, y: 3, scale: { x: 1.5, y: 1.5 } };
    const next = zoomAt(view, { x: 50, y: 50 }, 1);
    expect(next.scale.x).toBeCloseTo(1.5);
    expect(next.scale.y).toBeCloseTo(1.5);
    expect(next.x).toBeCloseTo(7);
    expect(next.y).toBeCloseTo(3);
  });
});

describe('zoomAt — per-axis', () => {
  it('per-axis factor scales each axis independently', () => {
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const next = zoomAt(view, { x: 0, y: 0 }, { x: 2, y: 4 });
    expect(next.scale.x).toBe(2);
    expect(next.scale.y).toBe(4);
  });

  it('per-axis factor preserves the anchor on each axis', () => {
    const view = { x: 10, y: 20, scale: { x: 1, y: 1 } };
    const anchor = { x: 100, y: 50 };
    // worldX = 100/1 + 10 = 110; worldY = 50/1 + 20 = 70
    const next = zoomAt(view, anchor, { x: 2, y: 4 });
    expect(anchor.x / next.scale.x + next.x).toBeCloseTo(110);
    expect(anchor.y / next.scale.y + next.y).toBeCloseTo(70);
  });

  it('per-axis clamp bounds clamp each axis independently', () => {
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const next = zoomAt(view, { x: 0, y: 0 }, 100, {
      min: { x: 0.5, y: 0.25 },
      max: { x: 2, y: 5 },
    });
    expect(next.scale.x).toBe(2);
    expect(next.scale.y).toBe(5);
  });

  it('scalar clamp applies the same bound to both axes', () => {
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const next = zoomAt(view, { x: 0, y: 0 }, { x: 100, y: 0.001 }, { min: 0.5, max: 2 });
    expect(next.scale.x).toBe(2);
    expect(next.scale.y).toBe(0.5);
  });
});
