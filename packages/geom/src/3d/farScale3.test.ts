import { describe, expect, it } from 'vitest';
import { distance, intersectRayPlane, len, nearestPointOnLine, nearestPointsRayLine } from './index';

describe('3D lengths at either end of the double range', () => {
  for (const scale of [1e-200, 1e200]) {
    it(`measures a vector of ${scale}`, () => {
      expect(len({ x: 3 * scale, y: 0, z: 4 * scale }) / scale).toBeCloseTo(5, 12);
      expect(distance({ x: 0, y: 0, z: 0 }, { x: 0, y: 3 * scale, z: 4 * scale }) / scale).toBeCloseTo(5, 12);
    });
  }

  it('meets a plane along a ray whose direction is tiny, or whose normal is huge', () => {
    const origin = { x: 0, y: 5, z: 0 };
    expect(intersectRayPlane({ origin, direction: { x: 0, y: -1e-170, z: 0 } }, { x: 0, y: 1, z: 0 }, 0)).toBeCloseTo(5e170, -160);
    expect(intersectRayPlane({ origin, direction: { x: 0, y: -1, z: 0 } }, { x: 0, y: 1e200, z: 0 }, 0)).toBeCloseTo(5, 12);
  });

  for (const scale of [1e-170, 1e170]) {
    it(`projects onto a line whose direction is ${scale}`, () => {
      const p = nearestPointOnLine({ x: 3, y: 4, z: 0 }, { x: 0, y: 0, z: 0 }, { x: scale, y: 0, z: 0 });
      expect(p.x).toBeCloseTo(3, 12);
      expect(p.y).toBe(0);
    });

    it(`pairs a ray with a line when the directions are ${scale}`, () => {
      const r = nearestPointsRayLine(
        { origin: { x: 0, y: 0, z: 0 }, direction: { x: scale, y: 0, z: 0 } },
        { x: 5, y: -3, z: 2 }, { x: 0, y: scale, z: 0 },
      );
      expect(r.onRay.x).toBeCloseTo(5, 12);
      expect(r.onLine.x).toBeCloseTo(5, 12);
      expect(r.onLine.y).toBeCloseTo(0, 12);
      expect(r.onLine.z).toBeCloseTo(2, 12);
      expect(r.t * scale).toBeCloseTo(5, 12);
      expect(r.s * scale).toBeCloseTo(3, 12);
    });
  }
});

describe('nearestPointsRayLine with a line of no direction', () => {
  it('pairs the point with the ray point nearest it', () => {
    const r = nearestPointsRayLine(
      { origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } }, { x: 5, y: 3, z: 0 }, { x: 0, y: 0, z: 0 },
    );
    expect(r.t).toBe(5);
    expect(r.onRay).toEqual({ x: 5, y: 0, z: 0 });
    expect(r.onLine).toEqual({ x: 5, y: 3, z: 0 });
    expect(r.s).toBe(0);
  });

  it('pairs a point behind the ray with its origin', () => {
    const r = nearestPointsRayLine(
      { origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } }, { x: -5, y: 3, z: 0 }, { x: 0, y: 0, z: 0 },
    );
    expect(r.t).toBe(0);
  });
});
