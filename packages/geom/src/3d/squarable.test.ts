import { describe, expect, it } from 'vitest';
import { nearestPointOnLine, nearestPointsRayLine } from './ray3';

describe('a subnormal direction', () => {
  it('still projects onto the line', () => {
    const p = nearestPointOnLine({ x: 1, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1e-310, y: 0, z: 0 });
    expect(p).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('still pairs a ray with the line', () => {
    const ray = { origin: { x: 0, y: 0, z: 1 }, direction: { x: 0, y: 0, z: -1 } };
    const r = nearestPointsRayLine(ray, { x: 0, y: 0, z: 0 }, { x: 1e-310, y: 0, z: 0 });
    expect(r.onRay).toEqual({ x: 0, y: 0, z: 0 });
    expect(r.onLine).toEqual({ x: 0, y: 0, z: 0 });
    expect(r.t).toBe(1);
    const sub = nearestPointsRayLine(
      { origin: { x: 1, y: 1, z: 0 }, direction: { x: 0, y: -1e-310, z: 0 } },
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    );
    expect(sub.onRay.x).toBe(1);
    expect(sub.onRay.y).toBeCloseTo(0);
    expect(sub.onLine).toEqual({ x: 1, y: 0, z: 0 });
  });
});
