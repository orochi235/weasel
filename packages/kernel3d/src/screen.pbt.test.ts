/**
 * A viewport's two directions against each other: the screen and NDC conversions invert, every point on the ray a
 * screen point names projects back to it, a ray through where a point projects passes through the point, and the
 * screen box of a world box covers every point of it the camera draws.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { add, cross, dot, len, normalize, pointOnRay, scale, sub, type Aabb, type Vec3 } from '@weasel-js/geom/3d';
import { cameraEye } from './camera';
import { paneAt, paneFractions, runs, tally, timeoutFor, v3, viewport } from './pbt.fixture';
import { projectPoint, rayAt, rectOf, viewProjectionOf, type Viewport3d } from './project';
import { ndcToScreen, projectAabbToScreen, screenToNdc } from './screen';

const RUNS = 300;
const T = timeoutFor(RUNS, 2);

const unit = fc.double({ min: 0, max: 1, noNaN: true });

function forwardOf(vp: Viewport3d): { eye: Vec3; forward: Vec3 } {
  const eye = cameraEye(vp.camera);
  return { eye, forward: normalize(sub(vp.camera.target, eye)) };
}

const depthOf = (vp: Viewport3d, p: Vec3): number => {
  const { eye, forward } = forwardOf(vp);
  return dot(sub(p, eye), forward);
};

/** A world point the camera draws: its screen fractions, and a depth between the planes. */
function drawn(vp: Viewport3d, fx: number, fy: number, t: number): Vec3 {
  const ray = rayAt(vp, paneAt(vp, { fx, fy }))!;
  return pointOnRay(ray, t);
}

describe('screen and NDC, property', () => {
  it('invert each other in any rect', () => {
    const rect = fc.record({
      x: fc.integer({ min: -1000, max: 1000 }), y: fc.integer({ min: -1000, max: 1000 }),
      width: fc.integer({ min: 1, max: 4000 }), height: fc.integer({ min: 1, max: 4000 }),
    });
    const at = fc.record({ x: fc.double({ min: -5000, max: 5000, noNaN: true }), y: fc.double({ min: -5000, max: 5000, noNaN: true }) });
    fc.assert(fc.property(rect, at, (r, p) => {
      const back = ndcToScreen(screenToNdc(p, r), r);
      expect(Math.abs(back.x - p.x)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(back.y - p.y)).toBeLessThanOrEqual(1e-9);
    }), runs(RUNS));
  }, T);
});

describe('rayAt and projectPoint, property', () => {
  it('names a ray for every point of the pane, and every point on it between the planes projects back there', () => {
    fc.assert(fc.property(viewport, paneFractions(), fc.double({ min: 0.001, max: 1, noNaN: true }), (vp, f, t) => {
      const s = paneAt(vp, f);
      const ray = rayAt(vp, s);
      expect(ray).not.toBeNull();
      const back = projectPoint(pointOnRay(ray!, t), vp);
      expect(back).not.toBeNull();
      const tol = 1e-6 * (vp.width + vp.height);
      expect(Math.abs(back!.x - s.x)).toBeLessThanOrEqual(tol);
      expect(Math.abs(back!.y - s.y)).toBeLessThanOrEqual(tol);
    }), runs(RUNS));
  }, T);

  it('runs from the near plane to the far plane', () => {
    fc.assert(fc.property(viewport, paneFractions(), (vp, f) => {
      const ray = rayAt(vp, paneAt(vp, f))!;
      const { near, far } = vp.camera;
      expect(Math.abs(depthOf(vp, ray.origin) - near)).toBeLessThanOrEqual(1e-6 * (1 + near + vp.camera.distance));
      expect(Math.abs(depthOf(vp, pointOnRay(ray, 1)) - far)).toBeLessThanOrEqual(1e-6 * far);
    }), runs(RUNS));
  }, T);

  it('casts the ray through where a point projects through the point', () => {
    const seen = tally();
    fc.assert(fc.property(viewport, v3(200), (vp, p) => {
      const s = projectPoint(p, vp);
      const depth = depthOf(vp, p);
      if (depth > vp.camera.near * 1.001) {
        expect(s).not.toBeNull();
      }
      if (s === null) {
        seen.count('behind');
        return;
      }
      seen.count('projected');
      const ray = rayAt(vp, s)!;
      const d = normalize(ray.direction);
      const off = len(cross(sub(p, ray.origin), d));
      expect(off).toBeLessThanOrEqual(1e-7 * (1 + depth) * (1 + len(p)));
    }), runs(RUNS));
    seen.atLeast('projected', 50);
    seen.atLeast('behind', 10);
  }, T);
});

const boxNear = (vp: Viewport3d, at: Vec3, a: Vec3, b: Vec3): Aabb => {
  const p = add(at, a);
  const q = add(at, b);
  return {
    min: { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), z: Math.min(p.z, q.z) },
    max: { x: Math.max(p.x, q.x), y: Math.max(p.y, q.y), z: Math.max(p.z, q.z) },
  };
};

describe('projectAabbToScreen, property', () => {
  it('covers the screen point of every point of the box the camera draws', () => {
    const seen = tally();
    fc.assert(fc.property(
      viewport, paneFractions(), fc.double({ min: 0, max: 0.05, noNaN: true }), v3(5), v3(5), fc.tuple(unit, unit, unit),
      (vp, f, t, a, b, [u, v, w]) => {
        const box = boxNear(vp, drawn(vp, f.fx, f.fy, t), a, b);
        const inside: Vec3 = {
          x: box.min.x + (box.max.x - box.min.x) * u,
          y: box.min.y + (box.max.y - box.min.y) * v,
          z: box.min.z + (box.max.z - box.min.z) * w,
        };
        const rect = projectAabbToScreen(box, viewProjectionOf(vp), rectOf(vp));
        const depth = depthOf(vp, inside);
        const s = depth >= vp.camera.near * 1.001 && depth <= vp.camera.far * 0.999 ? projectPoint(inside, vp) : null;
        if (s === null) {
          seen.count('not drawn');
          return;
        }
        seen.count(depthOf(vp, box.min) < vp.camera.near || depthOf(vp, box.max) < vp.camera.near ? 'straddling' : 'drawn');
        expect(rect).not.toBeNull();
        const tol = 1e-6 * (1 + Math.abs(rect!.x) + Math.abs(rect!.y) + rect!.width + rect!.height);
        expect(s.x).toBeGreaterThanOrEqual(rect!.x - tol);
        expect(s.x).toBeLessThanOrEqual(rect!.x + rect!.width + tol);
        expect(s.y).toBeGreaterThanOrEqual(rect!.y - tol);
        expect(s.y).toBeLessThanOrEqual(rect!.y + rect!.height + tol);
      },
    ), runs(RUNS));
    seen.atLeast('drawn', 30);
    seen.atLeast('straddling', 10);
  }, T);

  it('reports a point box drawn as the point itself', () => {
    fc.assert(fc.property(viewport, paneFractions(), fc.double({ min: 0.001, max: 0.999, noNaN: true }), (vp, f, t) => {
      const p = drawn(vp, f.fx, f.fy, t);
      const rect = projectAabbToScreen({ min: p, max: p }, viewProjectionOf(vp), rectOf(vp));
      const s = projectPoint(p, vp)!;
      expect(rect).not.toBeNull();
      const tol = 1e-9 * (1 + Math.abs(s.x) + Math.abs(s.y));
      expect(Math.abs(rect!.x - s.x)).toBeLessThanOrEqual(tol);
      expect(Math.abs(rect!.y - s.y)).toBeLessThanOrEqual(tol);
      expect(rect!.width).toBe(0);
      expect(rect!.height).toBe(0);
    }), runs(RUNS));
  }, T);

  it('reports nothing for a box wholly behind the eye', () => {
    fc.assert(fc.property(viewport, v3(5), v3(5), fc.double({ min: 1, max: 100, noNaN: true }), (vp, a, b, back) => {
      const { eye, forward } = forwardOf(vp);
      const reach = Math.max(len(a), len(b));
      const box = boxNear(vp, sub(eye, scale(forward, back + reach * 2)), a, b);
      expect(projectAabbToScreen(box, viewProjectionOf(vp), rectOf(vp))).toBeNull();
    }), runs(RUNS));
  }, T);
});
