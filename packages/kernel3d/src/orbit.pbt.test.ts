/**
 * The orbit camera's gestures as a sequence and against each other: any input, non-finite and past the double range
 * included, leaves a finite camera finite; pans and dollies about one point compose; a turn keeps the target at the
 * middle of the pane; and the picture is the same under moving, scaling, and offsetting the whole world and pane.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { add, scale, type Vec3 } from '@weasel-js/geom/3d';
import { dollyBy, dollyToward, orbitBy, panBy, type Camera3d } from './camera';
import { camera, isFinite3, maxDiff3, runs, tally, timeoutFor, v3, viewport } from './pbt.fixture';
import { projectPoint, rayAt } from './project';

const RUNS = 300;
const T = timeoutFor(RUNS, 2);

const finiteCamera = (c: Camera3d): boolean =>
  isFinite3(c.target) && [c.yaw, c.pitch, c.distance, c.fov, c.near, c.far].every(Number.isFinite);

/** Any input a gesture might be handed, the ends of the double range included. */
const wild = fc.oneof(
  { weight: 4, arbitrary: fc.double({ min: -1e4, max: 1e4, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity, 1e308, -1e308, 5e-324, 0) },
);
const pane = fc.record({ width: fc.integer({ min: 1, max: 2000 }), height: fc.integer({ min: 1, max: 2000 }) });
const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({ kind: fc.constant('orbit' as const), a: wild, b: wild }),
  fc.record({ kind: fc.constant('dolly' as const), a: wild, b: wild }),
  fc.record({ kind: fc.constant('pan' as const), a: wild, b: wild }),
  fc.record({ kind: fc.constant('toward' as const), a: wild, b: wild }),
);

type Step = { kind: 'orbit' | 'dolly' | 'pan' | 'toward'; a: number; b: number };

function apply(c: Camera3d, s: Step, size: { width: number; height: number }): Camera3d {
  switch (s.kind) {
    case 'orbit': return orbitBy(c, s.a, s.b);
    case 'dolly': return dollyBy(c, s.a);
    case 'pan': return panBy(c, s.a, s.b, size.height);
    default: return dollyToward(c, s.a, { x: s.b, y: s.b }, size);
  }
}

const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('orbit camera gestures, property', () => {
  it('leave a finite camera finite through any sequence of inputs, or as it was', () => {
    const seen = tally();
    fc.assert(fc.property(camera, pane, fc.array(step, { maxLength: 40 }), (c0, size, steps) => {
      let c = c0;
      for (const s of steps) {
        const next = apply(c, s, size);
        if (next === c) seen.count('unchanged');
        expect(finiteCamera(next)).toBe(true);
        c = next;
      }
    }), runs(RUNS));
    seen.atLeast('unchanged', 20);
  }, T);

  it('compose two pans into the pan by their sum', () => {
    const d = fc.double({ min: -1000, max: 1000, noNaN: true });
    fc.assert(fc.property(camera, pane, d, d, d, d, (c, size, ax, ay, bx, by) => {
      const twice = panBy(panBy(c, ax, ay, size.height), bx, by, size.height);
      const once = panBy(c, ax + bx, ay + by, size.height);
      const reach = c.distance * (1 + Math.abs(ax) + Math.abs(ay) + Math.abs(bx) + Math.abs(by));
      expect(maxDiff3(twice.target, once.target)).toBeLessThanOrEqual(1e-12 * (reach + 100));
    }), runs(RUNS));
  }, T);

  it('compose two dollies about one point into the dolly by their product, inside the limits', () => {
    const seen = tally();
    const f = fc.double({ min: 0.5, max: 2, noNaN: true });
    fc.assert(fc.property(camera, pane, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), f, f,
      (c, size, fx, fy, a, b) => {
        const at = { x: fx * size.width, y: fy * size.height };
        if (dollyBy(dollyBy(c, a), b).distance !== c.distance * a * b || dollyBy(c, a).distance !== c.distance * a) return;
        seen.count('inside');
        const twice = dollyToward(dollyToward(c, a, at, size), b, at, size);
        const once = dollyToward(c, a * b, at, size);
        near(twice.distance, once.distance, 1e-12 * c.distance);
        expect(maxDiff3(twice.target, once.target)).toBeLessThanOrEqual(1e-9 * (c.distance + 100));
      }), runs(RUNS));
    seen.atLeast('inside', 100);
  }, T);

  it('keeps the target at the middle of the pane through any turn', () => {
    const angle = fc.double({ min: -10, max: 10, noNaN: true });
    fc.assert(fc.property(viewport, angle, angle, (vp, dy, dp) => {
      const turned = { ...vp, camera: orbitBy(vp.camera, dy, dp) };
      const s = projectPoint(turned.camera.target, turned)!;
      const tol = 1e-9 * (vp.width + vp.height);
      near(s.x, (vp.originX ?? 0) + vp.width / 2, tol);
      near(s.y, (vp.originY ?? 0) + vp.height / 2, tol);
    }), runs(RUNS));
  }, T);
});

describe('the picture, metamorphic', () => {
  it('is the same with the world and the camera moved together', () => {
    fc.assert(fc.property(viewport, v3(200), v3(1e4), (vp, p, by) => {
      const moved = { ...vp, camera: { ...vp.camera, target: add(vp.camera.target, by) } };
      const a = projectPoint(p, vp);
      const b = projectPoint(add(p, by), moved);
      if (a === null || b === null) return;
      const tol = 1e-7 * (1 + Math.abs(a.x) + Math.abs(a.y)) * (1 + Math.abs(by.x) + Math.abs(by.y) + Math.abs(by.z));
      near(b.x, a.x, tol);
      near(b.y, a.y, tol);
    }), runs(RUNS));
  }, T);

  it('is the same with the world, the camera\'s distance, and its planes scaled together', () => {
    const k = fc.oneof(fc.double({ min: 1e-6, max: 1e6, noNaN: true }), fc.constantFrom(1e-100, 1e100));
    fc.assert(fc.property(viewport, v3(200), k, (vp, p, s) => {
      const c = vp.camera;
      const scaled = { ...vp, camera: { ...c, target: scale(c.target, s), distance: c.distance * s, near: c.near * s, far: c.far * s } };
      const a = projectPoint(p, vp);
      const b = projectPoint(scale(p, s), scaled);
      expect(b === null).toBe(a === null);
      if (a === null || b === null) return;
      const tol = 1e-7 * (1 + Math.abs(a.x) + Math.abs(a.y));
      near(b.x, a.x, tol);
      near(b.y, a.y, tol);
    }), runs(RUNS));
  }, T);

  it('moves with the pane on the page, and casts the same ray from the same place on the pane', () => {
    const o = fc.integer({ min: -5000, max: 5000 });
    fc.assert(fc.property(viewport, v3(200), o, o, fc.record({ fx: fc.double({ min: 0, max: 1, noNaN: true }), fy: fc.double({ min: 0, max: 1, noNaN: true }) }),
      (vp, p, ox, oy, f) => {
        const moved = { ...vp, originX: (vp.originX ?? 0) + ox, originY: (vp.originY ?? 0) + oy };
        const a = projectPoint(p, vp);
        const b = projectPoint(p, moved);
        expect(b === null).toBe(a === null);
        if (a && b) {
          near(b.x, a.x + ox, 1e-9 * (1 + Math.abs(a.x) + Math.abs(ox)));
          near(b.y, a.y + oy, 1e-9 * (1 + Math.abs(a.y) + Math.abs(oy)));
        }
        const at = { x: (vp.originX ?? 0) + f.fx * vp.width, y: (vp.originY ?? 0) + f.fy * vp.height };
        const ra = rayAt(vp, at)!;
        const rb = rayAt(moved, { x: at.x + ox, y: at.y + oy })!;
        const reach = (r: { origin: Vec3; direction: Vec3 }) => 1 + Math.abs(r.origin.x) + Math.abs(r.direction.x) + Math.abs(r.direction.y) + Math.abs(r.direction.z);
        expect(maxDiff3(ra.origin, rb.origin)).toBeLessThanOrEqual(1e-9 * reach(ra) * (1 + Math.abs(ox) + Math.abs(oy)));
        expect(maxDiff3(ra.direction, rb.direction)).toBeLessThanOrEqual(1e-9 * reach(ra) * (1 + Math.abs(ox) + Math.abs(oy)));
      }), runs(RUNS));
  }, T);
});
