/**
 * The ground and what stands on it: aim points and world points converting both ways under every axis `up`, a ground
 * hit lying on the ground under the pointer, a 3D pane as an aim space projecting and unprojecting to the same place,
 * and an insert's footprint spanning exactly the ground its drag swept.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { NodeId } from '@weasel-js/routing';
import { dot, type Vec3 } from '@weasel-js/geom/3d';
import { aimSpace3d } from './aim';
import { createCamera } from './camera';
import { fromAimPoint, groundAxes, groundHit, toAimPoint } from './ground';
import { createInsert, type Footprint } from './insert';
import { coord, isFinite3, paneAt, paneFractions, runs, tally, timeoutFor, v3, viewport } from './pbt.fixture';
import { projectPoint, type Viewport3d } from './project';

const RUNS = 300;
const T = timeoutFor(RUNS, 2);

/** An axis `up`, either way along it, sometimes with rounding left in the other two. */
const up: fc.Arbitrary<Vec3> = fc.tuple(
  fc.constantFrom('x', 'y', 'z'), fc.constantFrom(1, -1), fc.boolean(),
).map(([axis, sign, noisy]) => {
  const v = { x: 0, y: 0, z: 0 };
  v[axis as 'x' | 'y' | 'z'] = sign;
  if (noisy) for (const a of ['x', 'y', 'z'] as const) if (a !== axis) v[a] = Math.cos(Math.PI / 2);
  return v;
});

const pointOf = (vp: Viewport3d, f: { fx: number; fy: number }) => paneAt(vp, f);

describe('ground axes and aim points, property', () => {
  it('name three distinct axes, and convert world points both ways exactly', () => {
    fc.assert(fc.property(up, v3(1e6), (u, p) => {
      const axes = groundAxes(u);
      expect(new Set([axes.u, axes.v, axes.up]).size).toBe(3);
      expect(axes.sign).toBe(Math.sign(u[axes.up]));
      const back = fromAimPoint(toAimPoint(p, axes), axes);
      expect(back).toEqual({ ...p, [axes.up]: p[axes.up] + 0 });
      const flat = { x: p.x, y: p.y };
      expect(toAimPoint(fromAimPoint(flat, axes), axes)).toEqual({ ...flat, z: 0 });
    }), runs(RUNS));
  }, T);
});

describe('groundHit, property', () => {
  it('lies on the ground under the pointer, or there is none', () => {
    const seen = tally();
    fc.assert(fc.property(viewport, paneFractions(), up, (vp, f, u) => {
      const s = pointOf(vp, f);
      const hit = groundHit(vp, s, u);
      if (hit === null) {
        seen.count('missed');
        return;
      }
      seen.count('hit');
      expect(isFinite3(hit)).toBe(true);
      const scale = 1 + Math.abs(hit.x) + Math.abs(hit.y) + Math.abs(hit.z);
      expect(Math.abs(dot(hit, u))).toBeLessThanOrEqual(1e-9 * scale);
      const back = projectPoint(hit, vp);
      if (back === null) return;
      seen.count('drawn');
      const tol = 1e-6 * (vp.width + vp.height) * scale;
      expect(Math.abs(back.x - s.x)).toBeLessThanOrEqual(tol);
      expect(Math.abs(back.y - s.y)).toBeLessThanOrEqual(tol);
    }), runs(RUNS));
    seen.atLeast('hit', 50);
    seen.atLeast('missed', 20);
    seen.atLeast('drawn', 50);
  }, T);
});

describe('aimSpace3d, property', () => {
  it('unprojects onto the ground at height 0, with a near-axis `up` too (shrunk)', () => {
    const vp: Viewport3d = { camera: createCamera({ distance: 0.5, fov: 0.2 }), width: 207, height: 20 };
    const space = aimSpace3d(vp, null, { up: { x: 6.123233995736766e-17, y: 6.123233995736766e-17, z: 1 } });
    expect(space.unproject({ x: 0, y: 0 })!.z).toBe(0);
  });

  it('unprojects a pane point onto the ground and projects it back to the same pixel', () => {
    const seen = tally();
    fc.assert(fc.property(viewport, paneFractions(), up, (vp, { fx, fy }, u) => {
      const space = aimSpace3d(vp, null, { up: u });
      const px = { x: fx * vp.width, y: fy * vp.height };
      const ground = space.unproject(px);
      if (ground === null) return;
      expect(ground.z).toBe(0);
      const back = space.project({ x: ground.x, y: ground.y });
      if (back === null) return;
      seen.count('round trip');
      const scale = 1 + Math.abs(ground.x) + Math.abs(ground.y);
      const tol = 1e-6 * (vp.width + vp.height) * scale;
      expect(Math.abs(back.x - px.x)).toBeLessThanOrEqual(tol);
      expect(Math.abs(back.y - px.y)).toBeLessThanOrEqual(tol);
    }), runs(RUNS));
    seen.atLeast('round trip', 50);
  }, T);

  it('projects a 2D point at the height it is given along `up`', () => {
    fc.assert(fc.property(viewport, up, coord(50), coord(50), coord(20), (vp, u, x, y, z) => {
      const axes = groundAxes(u);
      const space = aimSpace3d(vp, null, { up: u });
      const world = fromAimPoint({ x, y, z }, axes);
      expect(dot(world, u)).toBeCloseTo(z, 9);
      const s = projectPoint(world, vp);
      const p = space.project({ x, y, z });
      if (s === null) expect(p).toBeNull();
      else expect(p).toEqual({ x: s.x - (vp.originX ?? 0), y: s.y - (vp.originY ?? 0) });
    }), runs(RUNS));
  }, T);
});

function footprintOf(vp: Viewport3d, u: Vec3, minExtent: number, ...commit: Parameters<ReturnType<typeof createInsert>['commit']>): Footprint | null {
  let seen: Footprint | null = null;
  createInsert({ viewport: () => vp, up: u, minExtent, mint: (f) => ((seen = f), 'n' as NodeId) }).commit(...commit);
  return seen;
}

describe('createInsert, property', () => {
  it('spans the ground between a drag\'s ends, either way round, on the ground and no smaller than its minimum', () => {
    const seen = tally();
    fc.assert(fc.property(
      viewport, paneFractions(), paneFractions(), up, fc.double({ min: 0, max: 2, noNaN: true }), fc.boolean(),
      (vp, a, b, u, minExtent, fromCenter) => {
        const start = pointOf(vp, a);
        const end = pointOf(vp, b);
        const box = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
        const extras = { kind: 'rect' } as never;
        const f = footprintOf(vp, u, minExtent, box, extras, { start, end, fromCenter });
        const hs = groundHit(vp, start, u);
        const he = groundHit(vp, end, u);
        if (!hs || !he) {
          expect(f).toBeNull();
          seen.count('declined');
          return;
        }
        expect(f).not.toBeNull();
        seen.count(fromCenter ? 'from center' : 'corner to corner');
        const axes = groundAxes(u);
        expect(isFinite3(f!.center) && Number.isFinite(f!.width) && Number.isFinite(f!.depth)).toBe(true);
        expect(f!.center[axes.up]).toBe(0);
        const scale = 1 + Math.abs(hs[axes.u]) + Math.abs(hs[axes.v]) + Math.abs(he[axes.u]) + Math.abs(he[axes.v]);
        const tol = 1e-9 * scale;
        const k = fromCenter ? 2 : 1;
        const du = Math.abs(he[axes.u] - hs[axes.u]) * k;
        const dv = Math.abs(he[axes.v] - hs[axes.v]) * k;
        expect(Math.abs(f!.width - Math.max(minExtent, du))).toBeLessThanOrEqual(tol);
        expect(Math.abs(f!.depth - Math.max(minExtent, dv))).toBeLessThanOrEqual(tol);
        const mid = fromCenter ? hs : { x: (hs.x + he.x) / 2, y: (hs.y + he.y) / 2, z: (hs.z + he.z) / 2 };
        expect(Math.abs(f!.center[axes.u] - mid[axes.u])).toBeLessThanOrEqual(tol);
        expect(Math.abs(f!.center[axes.v] - mid[axes.v])).toBeLessThanOrEqual(tol);
        if (!fromCenter) {
          const swapped = footprintOf(vp, u, minExtent, box, extras, { start: end, end: start });
          expect(swapped).toEqual(f);
        }
      },
    ), runs(RUNS));
    seen.atLeast('declined', 20);
    seen.atLeast('from center', 30);
    seen.atLeast('corner to corner', 30);
  }, T);

  it('without ends, covers every corner of the dragged box cast onto the ground', () => {
    const seen = tally();
    fc.assert(fc.property(viewport, paneFractions(), paneFractions(), up, (vp, a, b, u) => {
      const p = pointOf(vp, a);
      const q = pointOf(vp, b);
      const box = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), width: Math.abs(q.x - p.x), height: Math.abs(q.y - p.y) };
      const f = footprintOf(vp, u, 0, box, { kind: 'rect' } as never);
      const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => groundHit(vp, { x: box.x + i! * box.width, y: box.y + j! * box.height }, u));
      if (corners.some((c) => c === null)) {
        expect(f).toBeNull();
        return;
      }
      seen.count('covered');
      const axes = groundAxes(u);
      for (const c of corners) {
        for (const [axis, extent] of [[axes.u, f!.width], [axes.v, f!.depth]] as const) {
          const tol = 1e-9 * (1 + Math.abs(c![axis]) + extent);
          expect(Math.abs(c![axis] - f!.center[axis])).toBeLessThanOrEqual(extent / 2 + tol);
        }
      }
    }), runs(RUNS));
    seen.atLeast('covered', 50);
  }, T);
});
