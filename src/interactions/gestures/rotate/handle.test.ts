/**
 * Tests for rotation-handle geometry helpers. The handle sits offset
 * above the rotated rect's top edge; `rotationHandle(pose)` produces its
 * world-space center, `hitRotationHandle(...)` is the square hit-test.
 */
import { describe, it, expect } from 'vitest';
import {
  rotationHandle,
  hitRotationHandle,
  DEFAULT_ROTATION_HANDLE_DISTANCE,
} from './handle';

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('rotationHandle', () => {
  it('axis-aligned rect: handle sits directly above top edge at DEFAULT distance', () => {
    const h = rotationHandle({ x: 0, y: 0, width: 10, height: 10 });
    expect(h.cx).toBe(5);
    expect(h.cy).toBe(-DEFAULT_ROTATION_HANDLE_DISTANCE);
  });

  it('explicit distance overrides the default', () => {
    const h = rotationHandle({ x: 0, y: 0, width: 10, height: 10 }, 50);
    expect(h.cy).toBe(-50);
  });

  it('rotation=0 matches the unrotated case', () => {
    const h = rotationHandle({ x: 0, y: 0, width: 10, height: 10, rotation: 0 });
    expect(h.cx).toBe(5);
    expect(h.cy).toBe(-DEFAULT_ROTATION_HANDLE_DISTANCE);
  });

  it('180° rotation flips the handle below the rect (sym around AABB center)', () => {
    // Rect 0..10 × 0..10, center (5,5). Pre-rotation top-center: (5, -24).
    // Vector from center: (0, -29). After 180°: (0, 29). Final: (5, 34).
    const h = rotationHandle({ x: 0, y: 0, width: 10, height: 10, rotation: Math.PI });
    const expectedRadius = 5 + DEFAULT_ROTATION_HANDLE_DISTANCE; // half-height + distance
    expect(close(h.cx, 5, 1e-6)).toBe(true);
    expect(close(h.cy, 5 + expectedRadius, 1e-6)).toBe(true);
  });

  it('90° rotation lands the handle to the right of the rect', () => {
    // Vector (0, -29) rotated +90° → (29, 0). Plus center (5,5) → (34, 5).
    const h = rotationHandle({ x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 2 });
    const expectedRadius = 5 + DEFAULT_ROTATION_HANDLE_DISTANCE;
    expect(close(h.cx, 5 + expectedRadius, 1e-6)).toBe(true);
    expect(close(h.cy, 5, 1e-6)).toBe(true);
  });

  it('missing rotation is treated as zero', () => {
    const a = rotationHandle({ x: 0, y: 0, width: 10, height: 10 });
    const b = rotationHandle({ x: 0, y: 0, width: 10, height: 10, rotation: 0 });
    expect(a).toEqual(b);
  });
});

describe('hitRotationHandle', () => {
  const h = { cx: 10, cy: 20 };

  it('center of handle is a hit', () => {
    expect(hitRotationHandle(h, 10, 20, 6)).toBe(true);
  });

  it('within radius is a hit (square boundary)', () => {
    expect(hitRotationHandle(h, 15, 25, 6)).toBe(true);
    expect(hitRotationHandle(h, 16, 26, 6)).toBe(true);
  });

  it('outside the square is a miss', () => {
    expect(hitRotationHandle(h, 17, 20, 6)).toBe(false);
    expect(hitRotationHandle(h, 10, 27, 6)).toBe(false);
  });

  it('hits use square (max-norm) not circular distance', () => {
    // Corner of the square at (cx+r, cy+r) is a hit; (cx+r+ε, cy) is a miss.
    expect(hitRotationHandle(h, 16, 26, 6)).toBe(true);
    expect(hitRotationHandle(h, 16.1, 20, 6)).toBe(false);
  });
});
