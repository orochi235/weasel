import { describe, expect, it } from 'vitest';
import { screenToWorld, worldToScreen } from './viewTransform';

describe('worldToScreen / screenToWorld', () => {
  const view = { panX: 10, panY: 20, zoom: 2 };

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
