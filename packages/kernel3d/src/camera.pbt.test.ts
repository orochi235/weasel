/**
 * The orbit camera: the eye at its distance, limits held whatever is asked for, turns adding up, a pan carrying the
 * point at the target with the pointer and undone by the opposite pan, and a dolly about a point keeping that point
 * under the pointer.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { distance, transformPoint4, type Vec3 } from '@weasel-js/geom/3d';
import {
  cameraEye, cameraViewProjection, clampCamera, createCamera, DEFAULT_ORBIT_LIMITS, dollyBy, dollyToward, MAX_PITCH, orbitBy, panBy,
  type Camera3d, type OrbitLimits,
} from './camera';
import { camera, maxDiff3, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const T = timeoutFor(RUNS, 2);
const camera0 = createCamera({ distance: 0.5, fov: 0.2 });

const angle = fc.double({ min: -10, max: 10, noNaN: true });
const pane = fc.record({ width: fc.integer({ min: 20, max: 2000 }), height: fc.integer({ min: 20, max: 2000 }) });

/** Any limits, the poles and an inverted pair included. */
const limits: fc.Arbitrary<Partial<OrbitLimits>> = fc.record({
  minDistance: fc.double({ min: 0.01, max: 100, noNaN: true }),
  maxDistance: fc.double({ min: 0.01, max: 1000, noNaN: true }),
  minPitch: fc.double({ min: -3, max: 3, noNaN: true }),
  maxPitch: fc.double({ min: -3, max: 3, noNaN: true }),
}, { requiredKeys: [] });

function onScreen(c: Camera3d, p: Vec3, size: { width: number; height: number }): { x: number; y: number } {
  const [x, y, , w] = transformPoint4(cameraViewProjection(c, size.width / size.height), p);
  return { x: ((x / w + 1) / 2) * size.width, y: ((1 - y / w) / 2) * size.height };
}

describe('orbit camera, property', () => {
  it('puts the eye its distance from the target', () => {
    fc.assert(fc.property(camera, (c) => {
      expect(Math.abs(distance(cameraEye(c), c.target) - c.distance)).toBeLessThanOrEqual(1e-12 * (c.distance + 100));
    }), runs(RUNS));
  }, T);

  it('holds pitch inside ±MAX_PITCH and inside the limits asked for, and settles in one step', () => {
    const seen = tally();
    const wild = fc.record({
      pitch: fc.double({ min: -10, max: 10, noNaN: true }),
      distance: fc.double({ min: 0, max: 2000, noNaN: true }),
    });
    fc.assert(fc.property(camera, wild, limits, (c0, { pitch, distance: d }, l) => {
      const c = { ...c0, pitch, distance: d };
      const out = clampCamera(c, l);
      expect(Math.abs(out.pitch)).toBeLessThanOrEqual(MAX_PITCH);
      const all = { ...DEFAULT_ORBIT_LIMITS, ...l };
      if (all.minPitch <= all.maxPitch && all.maxPitch >= -MAX_PITCH && all.minPitch <= MAX_PITCH) {
        expect(out.pitch).toBeGreaterThanOrEqual(all.minPitch);
        expect(out.pitch).toBeLessThanOrEqual(all.maxPitch);
        seen.count('pitch range');
      }
      if (all.minDistance <= all.maxDistance) {
        expect(out.distance).toBeGreaterThanOrEqual(all.minDistance);
        expect(out.distance).toBeLessThanOrEqual(all.maxDistance);
      }
      if (Math.abs(all.minPitch) > MAX_PITCH || Math.abs(all.maxPitch) > MAX_PITCH) seen.count('past a pole');
      expect(clampCamera(out, l)).toBe(out);
      expect([out.target, out.yaw, out.fov, out.near, out.far]).toEqual([c.target, c.yaw, c.fov, c.near, c.far]);
    }), runs(RUNS));
    seen.atLeast('pitch range', 30);
    seen.atLeast('past a pole', 30);
  }, T);

  it('holds pitch short of the pole when the lower limit asked for lies past it (shrunk)', () => {
    const out = clampCamera({ ...camera0, pitch: 0 }, { minPitch: 1.5607963267948968 });
    expect(out.pitch).toBe(MAX_PITCH);
  });

  it('adds turns to yaw exactly, keeping target and distance', () => {
    fc.assert(fc.property(camera, angle, angle, (c, dy, dp) => {
      const out = orbitBy(c, dy, dp);
      expect(out.yaw).toBe(c.yaw + dy);
      expect(out.target).toEqual(c.target);
      expect(out.distance).toBe(c.distance);
      if (Math.abs(c.pitch + dp) <= MAX_PITCH) expect(out.pitch).toBe(c.pitch + dp);
    }), runs(RUNS));
  }, T);

  it('carries the point at the target with the pointer, and the opposite pan undoes it', () => {
    const d = fc.double({ min: -1000, max: 1000, noNaN: true });
    fc.assert(fc.property(camera, pane, d, d, (c, size, dx, dy) => {
      const moved = panBy(c, dx, dy, size.height);
      const p = onScreen(moved, c.target, size);
      const tol = 1e-7 * (1 + Math.abs(dx) + Math.abs(dy) + size.width + size.height);
      expect(Math.abs(p.x - (size.width / 2 + dx))).toBeLessThanOrEqual(tol);
      expect(Math.abs(p.y - (size.height / 2 + dy))).toBeLessThanOrEqual(tol);
      expect([moved.yaw, moved.pitch, moved.distance]).toEqual([c.yaw, c.pitch, c.distance]);
      const back = panBy(moved, -dx, -dy, size.height);
      expect(maxDiff3(back.target, c.target)).toBeLessThanOrEqual(1e-12 * (1 + c.distance) * (1 + Math.abs(dx) + Math.abs(dy)) + 1e-12 * 100);
    }), runs(RUNS));
  }, T);

  it('keeps the point in the target plane under the pointer under it through a dolly', () => {
    const seen = tally();
    fc.assert(fc.property(
      camera, pane, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0.05, max: 20, noNaN: true }),
      (c, size, fx, fy, factor) => {
        const at = { x: fx * size.width, y: fy * size.height };
        const under = panBy(c, -(at.x - size.width / 2), -(at.y - size.height / 2), size.height).target;
        const out = dollyToward(c, factor, at, size);
        expect(out.distance).toBe(dollyBy(c, factor).distance);
        if (out.distance !== c.distance * factor) seen.count('held by a limit');
        const p = onScreen(out, under, size);
        const tol = 1e-6 * (size.width + size.height);
        expect(Math.abs(p.x - at.x)).toBeLessThanOrEqual(tol);
        expect(Math.abs(p.y - at.y)).toBeLessThanOrEqual(tol);
      },
    ), runs(RUNS));
    seen.atLeast('held by a limit', 10);
  }, T);
});
