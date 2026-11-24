import { describe, expect, it } from 'vitest';
import { nearestPointsRayLine } from './ray3';

describe('nearestPointsRayLine for a nearly parallel line', () => {
  const ray = { origin: { x: 0, y: 1, z: 0 }, direction: { x: 1, y: 0, z: 0 } };

  it('finds the closest pair at 1e-7 rad, past the parallel cutoff of 1e-12', () => {
    const r = nearestPointsRayLine(ray, { x: 10, y: 0, z: 0 }, { x: 1, y: 0, z: 1e-7 });
    expect(r.t).toBeCloseTo(10, 6);
    expect(r.s).toBeCloseTo(0, 6);
  });

  it('finds it at 1e-9 rad, where a·c − b² rounds to 0', () => {
    const r = nearestPointsRayLine(ray, { x: 10, y: 0, z: 0 }, { x: 1, y: 0, z: 1e-9 });
    expect(r.t).toBeCloseTo(10, 6);
  });

  it('pairs an exactly parallel line with the ray origin', () => {
    const r = nearestPointsRayLine(ray, { x: 10, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    expect(r.t).toBe(0);
    expect(r.onLine).toEqual({ x: 0, y: 0, z: 0 });
  });
});
