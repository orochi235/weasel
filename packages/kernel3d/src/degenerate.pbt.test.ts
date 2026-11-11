/**
 * The screen side under degenerate and non-finite cameras and panes: zero and straight-angle fields of view, a near
 * plane at the far one or past it, a camera on its target or at a pole, subnormal, huge, and non-finite fields, and
 * panes with no area. Every answer is either none or finite, and a camera that draws a point names a ray through
 * where it draws it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cross, len, normalize, sub, type Aabb } from '@weasel-js/geom/3d';
import { createCamera, MAX_PITCH, type Camera3d } from './camera';
import { isFinite3, runs, tally, timeoutFor, v3 } from './pbt.fixture';
import { projectPoint, rayAt, rectOf, viewProjectionOf, type Viewport3d } from './project';
import { projectAabbToScreen } from './screen';

const RUNS = 400;
const T = timeoutFor(RUNS, 2);

const EDGES = [0, -0, 5e-324, 1e-300, 1e-12, 1e300, Infinity, -Infinity, NaN, Math.PI, Math.PI / 2, -Math.PI / 2];

/** A value from `normal` most of the time, an edge of the double range otherwise. */
function edgy(normal: fc.Arbitrary<number>): fc.Arbitrary<number> {
  return fc.oneof({ weight: 8, arbitrary: normal }, { weight: 1, arbitrary: fc.constantFrom(...EDGES) });
}

const dbl = (min: number, max: number) => fc.double({ min, max, noNaN: true });

/** Any camera, degenerate ones often: each field normal or an edge on its own. */
const wildCamera: fc.Arbitrary<Camera3d> = fc.record({
  target: v3(20),
  yaw: edgy(dbl(-7, 7)),
  pitch: edgy(dbl(-MAX_PITCH, MAX_PITCH)),
  distance: edgy(dbl(0.5, 200)),
  fov: edgy(dbl(0.2, 2.5)),
  near: edgy(dbl(0.01, 5)),
  far: edgy(dbl(10, 5000)),
}).map((c) => createCamera(c));

const wildViewport: fc.Arbitrary<Viewport3d> = fc.record({
  camera: wildCamera,
  width: fc.oneof({ weight: 8, arbitrary: fc.integer({ min: 1, max: 2000 }) }, { weight: 1, arbitrary: fc.constantFrom(0, 0.5, 5e-324) }),
  height: fc.oneof({ weight: 8, arbitrary: fc.integer({ min: 1, max: 2000 }) }, { weight: 1, arbitrary: fc.constantFrom(0, 0.5, 5e-324) }),
});

/** Whether the camera and pane are ones a renderer draws an honest picture through. */
function sound({ camera: c, width, height }: Viewport3d): boolean {
  return [c.yaw, c.pitch, c.distance, c.fov, c.near, c.far].every(Number.isFinite) &&
    Math.abs(c.pitch) <= MAX_PITCH && c.distance >= 1e-6 && c.distance <= 1e6 &&
    c.fov >= 1e-3 && c.fov <= Math.PI - 1e-3 && c.near >= 1e-6 && c.far >= c.near * 1.001 && c.far <= 1e9 &&
    width >= 1 && height >= 1;
}

const screenPoint = fc.record({ x: dbl(-100, 2100), y: dbl(-100, 2100) });

const box: fc.Arbitrary<Aabb> = fc.tuple(v3(50), v3(5)).map(([at, r]) => ({
  min: { x: at.x - Math.abs(r.x), y: at.y - Math.abs(r.y), z: at.z - Math.abs(r.z) },
  max: { x: at.x + Math.abs(r.x), y: at.y + Math.abs(r.y), z: at.z + Math.abs(r.z) },
}));

describe('degenerate cameras and panes, property', () => {
  it('cast either no ray or a finite one with a direction', () => {
    fc.assert(fc.property(wildViewport, screenPoint, (vp, s) => {
      const ray = rayAt(vp, s);
      if (ray === null) return;
      expect(isFinite3(ray.origin) && isFinite3(ray.direction)).toBe(true);
      expect(len(ray.direction)).toBeGreaterThan(0);
    }), runs(RUNS));
  }, T);

  it('project a point to nothing or to a finite pixel, and a box to nothing or a finite box', () => {
    const seen = tally();
    fc.assert(fc.property(wildViewport, v3(100), box, (vp, p, b) => {
      const s = projectPoint(p, vp);
      if (s !== null) expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
      const r = projectAabbToScreen(b, viewProjectionOf(vp), rectOf(vp));
      seen.count(sound(vp) ? 'sound' : 'degenerate');
      if (r === null) return;
      expect([r.x, r.y, r.width, r.height].every(Number.isFinite)).toBe(true);
      expect(r.width).toBeGreaterThanOrEqual(0);
      expect(r.height).toBeGreaterThanOrEqual(0);
    }), runs(RUNS));
    seen.atLeast('degenerate', 60);
    seen.atLeast('sound', 60);
  }, T);

  it('draw nothing through a pane with no area, or a camera whose planes leave no depth between them', () => {
    const seen = tally();
    fc.assert(fc.property(wildViewport, v3(100), box, fc.boolean(), (vp0, p, b, flat) => {
      const vp = flat
        ? { ...vp0, ...(vp0.width > 0 ? { height: 0 } : { width: 0 }) }
        : { ...vp0, camera: { ...vp0.camera, far: vp0.camera.near } };
      seen.count(flat ? 'flat pane' : 'no depth');
      expect(projectPoint(p, vp)).toBeNull();
      expect(projectAabbToScreen(b, viewProjectionOf(vp), rectOf(vp))).toBeNull();
    }), runs(RUNS));
    seen.atLeast('flat pane', 50);
    seen.atLeast('no depth', 50);
  }, T);

  it('names a ray through where a sound camera draws a point, passing through it', () => {
    const seen = tally();
    fc.assert(fc.property(wildViewport.filter(sound), v3(100), (vp, p) => {
      const s = projectPoint(p, vp);
      if (s === null) return;
      seen.count('drawn');
      const ray = rayAt(vp, s);
      expect(ray).not.toBeNull();
      const off = len(cross(sub(p, ray!.origin), normalize(ray!.direction)));
      const eye = len(sub(p, ray!.origin));
      expect(off).toBeLessThanOrEqual(1e-6 * (1 + eye) * (1 + len(p)));
    }), runs(RUNS));
    seen.atLeast('drawn', 40);
  }, T);
});
