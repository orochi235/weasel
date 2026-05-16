import { describe, expect, it } from 'vitest';
import { screenToWorld, worldToScreen } from './viewTransform';

describe('worldToScreen / screenToWorld', () => {
  const view = { panX: 10, panY: 20, zoom: { x: 2, y: 2 } };

  it('converts world to screen coordinates', () => {
    const [sx, sy] = worldToScreen(5, 3, view);
    expect(sx).toBe(10 + 5 * 2);
    expect(sy).toBe(20 + 3 * 2);
  });

  it('converts screen to world coordinates', () => {
    const [wx, wy] = screenToWorld(20, 26, view);
    expect(wx).toBe(5);
    expect(wy).toBe(3);
  });

  it('roundtrips correctly', () => {
    const [sx, sy] = worldToScreen(7, 11, view);
    const [wx, wy] = screenToWorld(sx, sy, view);
    expect(wx).toBeCloseTo(7);
    expect(wy).toBeCloseTo(11);
  });
});

describe('per-axis zoom', () => {
  const view = { panX: 10, panY: 20, zoom: { x: 2, y: 3 } };

  it('multiplies each coord by its axis zoom', () => {
    const [sx, sy] = worldToScreen(5, 4, view);
    expect(sx).toBe(10 + 5 * 2);
    expect(sy).toBe(20 + 4 * 3);
  });

  it('round-trips per-axis', () => {
    const [sx, sy] = worldToScreen(7, 11, view);
    const [wx, wy] = screenToWorld(sx, sy, view);
    expect(wx).toBeCloseTo(7);
    expect(wy).toBeCloseTo(11);
  });
});
