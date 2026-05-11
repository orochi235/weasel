/**
 * Tests for rotate-gesture math primitives. Pure helpers — AABB center,
 * point rotation, rect-corner enumeration, and rotated point-in-rect
 * hit-test. Hot-path geometry; the selection overlay calls these every
 * frame during a rotation gesture.
 */
import { describe, it, expect } from 'vitest';
import {
  aabbCenter,
  rotatePoint,
  rectCorners,
  rotatedRectCorners,
  pointInRotatedRect,
} from './geometry';

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('aabbCenter', () => {
  it('returns the midpoint of an axis-aligned rect', () => {
    expect(aabbCenter({ x: 10, y: 20, width: 40, height: 60 })).toEqual({ x: 30, y: 50 });
  });

  it('handles zero-size rects without divide-by-zero', () => {
    expect(aabbCenter({ x: 5, y: 5, width: 0, height: 0 })).toEqual({ x: 5, y: 5 });
  });
});

describe('rotatePoint', () => {
  it('identity rotation returns the point unchanged', () => {
    const r = rotatePoint(3, 4, 0, 0, 0);
    expect(close(r.x, 3)).toBe(true);
    expect(close(r.y, 4)).toBe(true);
  });

  it('quarter turn around origin maps (1,0) → (0,1)', () => {
    const r = rotatePoint(1, 0, 0, 0, Math.PI / 2);
    expect(close(r.x, 0)).toBe(true);
    expect(close(r.y, 1)).toBe(true);
  });

  it('half turn around (5,5) maps (10,5) → (0,5)', () => {
    const r = rotatePoint(10, 5, 5, 5, Math.PI);
    expect(close(r.x, 0)).toBe(true);
    expect(close(r.y, 5)).toBe(true);
  });

  it('rotation around the pivot fixes the pivot', () => {
    const r = rotatePoint(7, 8, 7, 8, 1.234);
    expect(close(r.x, 7)).toBe(true);
    expect(close(r.y, 8)).toBe(true);
  });
});

describe('rectCorners', () => {
  it('returns corners in TL/TR/BR/BL order', () => {
    expect(rectCorners({ x: 0, y: 0, width: 10, height: 20 })).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ]);
  });
});

describe('rotatedRectCorners', () => {
  it('zero rotation matches axis-aligned rectCorners', () => {
    const r = rotatedRectCorners({ x: 0, y: 0, width: 10, height: 20, rotation: 0 });
    expect(r).toEqual(rectCorners({ x: 0, y: 0, width: 10, height: 20 }));
  });

  it('quarter turn around center swaps width/height extents', () => {
    // 10x20 rect centered at (5,10). After 90° CW (in screen Y-down, positive
    // angle is CW), the visual span flips. Compute the AABB of the rotated
    // corners and confirm it's 20×10 centered at (5,10).
    const rotated = rotatedRectCorners({ x: 0, y: 0, width: 10, height: 20, rotation: Math.PI / 2 });
    const xs = rotated.map((p) => p.x);
    const ys = rotated.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    expect(close(maxX - minX, 20)).toBe(true);
    expect(close(maxY - minY, 10)).toBe(true);
    expect(close((minX + maxX) / 2, 5)).toBe(true);
    expect(close((minY + maxY) / 2, 10)).toBe(true);
  });

  it('every corner stays at the same distance from the AABB center', () => {
    const pose = { x: 4, y: 4, width: 6, height: 8, rotation: 0.7 };
    const c = aabbCenter(pose);
    const rotated = rotatedRectCorners(pose);
    const axis = rectCorners(pose);
    for (let i = 0; i < 4; i++) {
      const d1 = Math.hypot(axis[i].x - c.x, axis[i].y - c.y);
      const d2 = Math.hypot(rotated[i].x - c.x, rotated[i].y - c.y);
      expect(close(d1, d2, 1e-6)).toBe(true);
    }
  });
});

describe('pointInRotatedRect', () => {
  it('center is always inside', () => {
    const pose = { x: 0, y: 0, width: 10, height: 10, rotation: 0.5 };
    const c = aabbCenter(pose);
    expect(pointInRotatedRect(pose, c.x, c.y)).toBe(true);
  });

  it('axis-aligned (rotation=0) reduces to AABB containment', () => {
    const pose = { x: 0, y: 0, width: 10, height: 10, rotation: 0 };
    expect(pointInRotatedRect(pose, 5, 5)).toBe(true);
    expect(pointInRotatedRect(pose, -1, 5)).toBe(false);
    expect(pointInRotatedRect(pose, 11, 5)).toBe(false);
  });

  it('45° rotation: corner outside AABB but inside rotated rect', () => {
    // Pose centered at (5,5), 10x10, rotated 45°. The world point (5, -1.4)
    // is outside an axis-aligned 10x10 at (0,0) but inside the 45°-rotated
    // version (which extends to y ≈ 5 - 5√2 ≈ -2.07 along the top vertex).
    const pose = { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 4 };
    expect(pointInRotatedRect(pose, 5, -1.4)).toBe(true);
    expect(pointInRotatedRect(pose, 5, -3)).toBe(false); // outside the rotated diamond
  });

  it('point well outside any rotation is outside', () => {
    const pose = { x: 0, y: 0, width: 10, height: 10, rotation: 1.234 };
    expect(pointInRotatedRect(pose, 100, 100)).toBe(false);
  });
});
