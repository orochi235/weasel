import { describe, it, expect } from 'vitest';
import { pointInRotatedAabb } from './rotationHitTest';

describe('pointInRotatedAabb', () => {
  const rect = { x: 0, y: 0, width: 100, height: 50 };

  it('rotation=0 ⇒ axis-aligned AABB test', () => {
    expect(pointInRotatedAabb(50, 25, { ...rect, rotation: 0 })).toBe(true);
    expect(pointInRotatedAabb(150, 25, { ...rect, rotation: 0 })).toBe(false);
  });

  it('30° — point that was outside is now inside (and vice versa)', () => {
    // Center is (50, 25). After 30° rotation, top-right corner (100, 0)
    // moves to roughly (93.3, 21.7) in screen space, so (95, 0) — outside
    // the original AABB — is INSIDE the rotated rect.
    expect(pointInRotatedAabb(95, 0, { ...rect, rotation: Math.PI / 6 })).toBe(false);
    // And a point just inside the original AABB top edge sweeps out.
    expect(pointInRotatedAabb(2, 2, { ...rect, rotation: Math.PI / 6 })).toBe(false);
  });

  it('45° — center always hits', () => {
    expect(pointInRotatedAabb(50, 25, { ...rect, rotation: Math.PI / 4 })).toBe(true);
  });

  it('90° — rotated rect occupies a 50×100 region centered on (50, 25)', () => {
    // Original AABB: x in [0,100], y in [0,50], center (50, 25).
    // Rotated 90°: x in [25, 75], y in [-25, 75] in world coords.
    expect(pointInRotatedAabb(30, 70, { ...rect, rotation: Math.PI / 2 })).toBe(true);
    expect(pointInRotatedAabb(10, 25, { ...rect, rotation: Math.PI / 2 })).toBe(false);
  });

  it('180° — equivalent to 0', () => {
    expect(pointInRotatedAabb(50, 25, { ...rect, rotation: Math.PI })).toBe(true);
    expect(pointInRotatedAabb(150, 25, { ...rect, rotation: Math.PI })).toBe(false);
  });

  it('-45° — symmetric with +45° about the center', () => {
    expect(pointInRotatedAabb(50, 25, { ...rect, rotation: -Math.PI / 4 })).toBe(true);
    // A point on the rotated extension axis should hit.
    const c = Math.cos(-Math.PI / 4), s = Math.sin(-Math.PI / 4);
    const tx = 50 + 40 * c, ty = 25 + 40 * s; // 40px along the rotated +x axis from center
    expect(pointInRotatedAabb(tx, ty, { ...rect, rotation: -Math.PI / 4 })).toBe(true);
  });

  it('undefined rotation behaves like 0', () => {
    expect(pointInRotatedAabb(50, 25, rect)).toBe(true);
    expect(pointInRotatedAabb(150, 25, rect)).toBe(false);
  });
});
