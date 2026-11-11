/**
 * A 3D view's aim drawn into a 2D one: its footprint on the ground is a convex outline wound one way with no point
 * twice, every corner on the ground inside what the camera sees and every point of the ground the pane shows inside
 * it; a pan carried through the aim and back leaves the camera where it was, and on its own pane shows at a move's start
 * what its end showed.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { aimSpace2d, type AimPoint } from '@weasel-js/core';
import { dot, normalize, sub } from '@weasel-js/geom/3d';
import { aimOf3d, aimSpace3d } from './aim';
import { cameraEye } from './camera';
import { groundHit } from './ground';
import { maxDiff3, paneAt, paneFractions, runs, tally, timeoutFor, viewport } from './pbt.fixture';
import { projectPoint, type Viewport3d } from './project';

const RUNS = 300;
const T = timeoutFor(RUNS, 3);
const UP = { x: 0, y: 1, z: 0 };
const FLAT = aimSpace2d(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 300 });

const cross2 = (o: AimPoint, a: AimPoint, b: AimPoint) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function inside(poly: readonly AimPoint[], p: AimPoint, tol: number): boolean {
  return poly.every((a, i) => cross2(a, poly[(i + 1) % poly.length]!, p) >= -tol);
}

/** Views looking down at the ground, so it fills some of the pane. */
const downView: fc.Arbitrary<Viewport3d> = fc.tuple(viewport, fc.double({ min: 0.05, max: 1.5, noNaN: true }), fc.double({ min: 20, max: 5000, noNaN: true }))
  .map(([vp, pitch, far]) => ({ ...vp, camera: { ...vp.camera, pitch, far, target: { ...vp.camera.target, y: Math.abs(vp.camera.target.y) / 4 } } }));

describe('aimOf3d drawn into 2D, property', () => {
  it('outlines a convex footprint wound one way, no corner twice, holding the ground the pane shows', () => {
    const seen = tally();
    fc.assert(fc.property(downView, fc.array(paneFractions(), { minLength: 1, maxLength: 6 }), (vp, fs) => {
      const out = aimOf3d(vp, 'v').outlineIn(FLAT);
      if (!out) {
        seen.count('none');
        return;
      }
      seen.count(`corners:${Math.min(out.length, 6)}`);
      const scale = Math.max(1, ...out.map((p) => Math.abs(p.x) + Math.abs(p.y)));
      for (let i = 0; i < out.length; i++) {
        const a = out[i]!, b = out[(i + 1) % out.length]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1e-9 * scale);
      }
      // Wound counterclockwise in the 2D world's x and y, and convex: every turn the same way.
      const turns = out.map((a, i) => cross2(a, out[(i + 1) % out.length]!, out[(i + 2) % out.length]!));
      for (const t of turns) expect(t).toBeGreaterThanOrEqual(-1e-9 * scale * scale);
      for (const f of fs) {
        const hit = groundHit(vp, paneAt(vp, f), UP);
        if (!hit) continue;
        const eye = cameraEye(vp.camera);
        const depth = dot(sub(hit, eye), normalize(sub(vp.camera.target, eye)));
        if (depth > vp.camera.far * 0.999 || depth < vp.camera.near * 1.001) continue;
        seen.count('shown');
        expect(inside(out, { x: hit.x, y: hit.z }, 1e-7 * scale * scale)).toBe(true);
      }
      for (const p of out) {
        // A corner where the near plane meets the ground lies on that plane, which rounding puts either side of.
        const s = projectPoint({ x: p.x, y: 0, z: p.y }, vp);
        if (!s) continue;
        seen.count('corner drawn');
        const tol = 1e-5 * (vp.width + vp.height);
        expect(s.x).toBeGreaterThanOrEqual((vp.originX ?? 0) - tol);
        expect(s.x).toBeLessThanOrEqual((vp.originX ?? 0) + vp.width + tol);
        expect(s.y).toBeGreaterThanOrEqual((vp.originY ?? 0) - tol);
        expect(s.y).toBeLessThanOrEqual((vp.originY ?? 0) + vp.height + tol);
      }
    }), runs(RUNS));
    seen.atLeast('corners:4', 30);
    seen.atLeast('shown', 100);
    seen.atLeast('corner drawn', 300);
  }, T);

  it('pans its camera by the move in the 2D world, and back by the opposite one', () => {
    fc.assert(fc.property(downView, fc.record({ x: fc.double({ min: -500, max: 500, noNaN: true }), y: fc.double({ min: -500, max: 500, noNaN: true }) }),
      fc.record({ x: fc.double({ min: -500, max: 500, noNaN: true }), y: fc.double({ min: -500, max: 500, noNaN: true }) }),
      (vp, from, to) => {
        const aim = aimOf3d(vp, 'v');
        const moved = aim.pannedIn(FLAT, from, to);
        expect(moved).not.toBeNull();
        const c = moved!.viewport.camera;
        const tol = 1e-12 * (1 + Math.abs(from.x) + Math.abs(from.y) + Math.abs(to.x) + Math.abs(to.y) + 100);
        expect(maxDiff3(c.target, { x: vp.camera.target.x + to.x - from.x, y: vp.camera.target.y, z: vp.camera.target.z + to.y - from.y })).toBeLessThanOrEqual(tol);
        const back = moved!.pannedIn(FLAT, to, from)!;
        expect(maxDiff3(back.viewport.camera.target, vp.camera.target)).toBeLessThanOrEqual(2 * tol);
      }), runs(RUNS));
  }, T);

  it('pans its camera by a move on its own pane so the ground at the move\'s start is what its end showed', () => {
    const seen = tally();
    fc.assert(fc.property(downView, paneFractions(), paneFractions(), (vp, a, b) => {
      const space = aimSpace3d(vp, 'v');
      const from = { x: a.fx * vp.width, y: a.fy * vp.height };
      const to = { x: b.fx * vp.width, y: b.fy * vp.height };
      const ends = space.unproject(to);
      const moved = aimOf3d(vp, 'v').pannedIn(space, from, to);
      if (!space.unproject(from) || !ends) {
        expect(moved).toBeNull();
        return;
      }
      seen.count('panned');
      const now = aimSpace3d(moved!.viewport, 'v').unproject(from);
      expect(now).not.toBeNull();
      const tol = 1e-8 * (1 + Math.abs(ends.x) + Math.abs(ends.y) + vp.camera.distance);
      expect(Math.abs(now!.x - ends.x)).toBeLessThanOrEqual(tol);
      expect(Math.abs(now!.y - ends.y)).toBeLessThanOrEqual(tol);
    }), runs(RUNS));
    seen.atLeast('panned', 100);
  }, T);
});
