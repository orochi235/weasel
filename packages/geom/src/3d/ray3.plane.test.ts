import { describe, expect, it } from 'vitest';
import { intersectRayPlane } from './ray3';

const Z = { x: 0, y: 0, z: 1 };

describe('intersectRayPlane with a non-finite input', () => {
  it('answers null for a NaN origin or offset', () => {
    expect(intersectRayPlane({ origin: { x: NaN, y: 0, z: 0 }, direction: Z }, { x: 1, y: 0, z: 1 }, 1)).toBeNull();
    expect(intersectRayPlane({ origin: { x: 0, y: 0, z: 0 }, direction: Z }, Z, NaN)).toBeNull();
  });

  it('answers null for an infinite origin, as intersectRayAabb does', () => {
    expect(intersectRayPlane({ origin: { x: 0, y: 0, z: -Infinity }, direction: Z }, Z, 1)).toBeNull();
  });

  it('still meets a plane ahead', () => {
    expect(intersectRayPlane({ origin: { x: 0, y: 0, z: 0 }, direction: Z }, Z, 2)).toBe(2);
  });
});
