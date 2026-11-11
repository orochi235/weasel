/**
 * The minimap's math and actions: the fit frames every mark and stays finite for any scene, empty and huge
 * included; minimap and world points round-trip through the fit; a press centers the main view on the point
 * under it, so the indicator sits there; a drag keeps it there; and a wheel zoom keeps the point under the
 * cursor where it was.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createScene, normalizeView, RECT_POSE_DESCRIPTOR, viewportWorldRect, type PoseDescriptor, type View, type ViewApi } from '@weasel-js/core';
import { viewScreenToWorld, viewWorldToScreen } from '@weasel-js/core';
import type { ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { computeFitView, computeIndicatorCommand, FALLBACK_FIT_VIEW } from './minimapMath';
import { minimapCenterAction, minimapPanAction, minimapZoomAction } from './actions';
import { runs, tally, timeoutFor } from './pbt.fixture';

interface Pose { x: number; y: number; width: number; height: number }
const descriptor = RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<Pose>;
const PADDING = 8;

const anyFinite = fc.oneof(
  { weight: 4, arbitrary: fc.double({ min: -1e4, max: 1e4, noNaN: true }) },
  { weight: 2, arbitrary: fc.double({ noNaN: true, noDefaultInfinity: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -0, 1e308, -1e308, Number.MAX_VALUE, -Number.MAX_VALUE, 5e-324) },
);
const anySize = fc.oneof(fc.double({ min: 0, max: 1e4, noNaN: true }), fc.double({ min: 0, max: Number.MAX_VALUE, noNaN: true }), fc.constant(0));
const anyPose: fc.Arbitrary<Pose> = fc.record({ x: anyFinite, y: anyFinite, width: anySize, height: anySize });
/** A mark small and near enough that a fit above the zoom floor holds every one. */
const nearPose: fc.Arbitrary<Pose> = fc.record({
  x: fc.double({ min: -1e6, max: 1e6, noNaN: true }), y: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
  width: fc.oneof(fc.constant(0), fc.double({ min: 1e-3, max: 1e5, noNaN: true })),
  height: fc.oneof(fc.constant(0), fc.double({ min: 1e-3, max: 1e5, noNaN: true })),
});
const dims = fc.record({ width: fc.integer({ min: 0, max: 2000 }), height: fc.integer({ min: 0, max: 2000 }) });
const measured = fc.record({ width: fc.integer({ min: 40, max: 2000 }), height: fc.integer({ min: 40, max: 2000 }) });
const scale = fc.oneof(fc.double({ min: 0.01, max: 100, noNaN: true }), fc.constantFrom(1e-9, 1, 1e9));
const view: fc.Arbitrary<View> = fc.record({ x: anyFinite, y: anyFinite, scale: fc.record({ x: scale, y: scale }) });

function sceneOf(poses: readonly Pose[]) {
  const scene = createScene<{ label: string }, 'bg', Pose>({ systemLayers: [{ id: 'bg' }] });
  for (const pose of poses) scene.add({ kind: 'mark', layer: 'bg', pose, data: { label: '' } });
  return scene;
}

const finiteView = (v: View): boolean => [v.x, v.y, v.scale.x, v.scale.y].every(Number.isFinite) && v.scale.x > 0 && v.scale.y > 0;

/** Agreement to within a few ulps of the larger side's magnitude. */
const near = (a: number, b: number, mag: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b), mag);

function rootOf(get: () => View, set: (v: View) => void, size: { width: number; height: number }): ViewApi {
  return { get, set, hostSize: () => size } as ViewApi;
}

describe('computeFitView, property', () => {
  it('is finite for any scene, empty and huge included, and the fallback for an empty one', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(anyPose, { maxLength: 6 }), dims, (poses, d) => {
      const v = computeFitView(sceneOf(poses), d, 'scene', descriptor);
      expect(finiteView(v)).toBe(true);
      if (poses.length === 0) expect(v).toEqual(FALLBACK_FIT_VIEW);
      if (poses.some((p) => Math.abs(p.x) > 1e300 || p.width > 1e300)) seen.count('huge');
      if (poses.length === 0) seen.count('empty');
    }), runs(300));
    seen.atLeast('huge', 30);
    seen.atLeast('empty', 10);
  }, timeoutFor(300, 3));

  it('frames every mark inside the padded minimap, centered on the content', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(nearPose, { minLength: 1, maxLength: 6 }), measured, (poses, d) => {
      const v = computeFitView(sceneOf(poses), d, 'scene', descriptor);
      const minX = Math.min(...poses.map((p) => p.x));
      const maxX = Math.max(...poses.map((p) => p.x + p.width));
      const minY = Math.min(...poses.map((p) => p.y));
      const maxY = Math.max(...poses.map((p) => p.y + p.height));
      if (maxX - minX === 0 && maxY - minY === 0) { expect(v.scale).toEqual({ x: 1, y: 1 }); return; }
      expect(v.scale.x).toBe(v.scale.y);
      const eps = 1e-6 * Math.max(d.width, d.height) + 8 * Number.EPSILON * Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY)) * v.scale.x;
      const a = viewWorldToScreen(v, { x: minX, y: minY });
      const b = viewWorldToScreen(v, { x: maxX, y: maxY });
      for (const s of [a, b]) {
        expect(s.x).toBeGreaterThanOrEqual(PADDING - eps);
        expect(s.x).toBeLessThanOrEqual(d.width - PADDING + eps);
        expect(s.y).toBeGreaterThanOrEqual(PADDING - eps);
        expect(s.y).toBeLessThanOrEqual(d.height - PADDING + eps);
      }
      // The world coordinates' own rounding, magnified by the fit's scale.
      const slack = 1e-6 + 8 * Number.EPSILON * Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY)) * v.scale.x;
      expect(Math.abs((a.x + b.x) / 2 - d.width / 2)).toBeLessThanOrEqual(slack);
      expect(Math.abs((a.y + b.y) / 2 - d.height / 2)).toBeLessThanOrEqual(slack);
      // The fit is tight on one axis.
      const fillX = (b.x - a.x) / (d.width - 2 * PADDING);
      const fillY = (b.y - a.y) / (d.height - 2 * PADDING);
      expect(Math.max(fillX, fillY)).toBeCloseTo(1, 6);
      seen.count('framed');
    }), runs(300));
    seen.atLeast('framed', 150);
  }, timeoutFor(300, 3));

  it('frames a mark too small for any scale at the largest one, centered on it', () => {
    fc.assert(fc.property(fc.double({ min: -1e4, max: 1e4, noNaN: true }), fc.double({ min: -1e4, max: 1e4, noNaN: true }),
      fc.constantFrom(5e-324, 1e-320, 1e-310, 1e-305), fc.boolean(), measured, (x, y, size, wide, d) => {
        const pose = wide ? { x: 0, y, width: size, height: 0 } : { x, y: 0, width: 0, height: size };
        const v = computeFitView(sceneOf([pose]), d, 'scene', descriptor);
        expect(finiteView(v)).toBe(true);
        const small = computeFitView(sceneOf([{ ...pose, width: pose.width && 1e-300, height: pose.height && 1e-300 }]), d, 'scene', descriptor);
        expect(v.scale.x).toBeGreaterThanOrEqual(small.scale.x);
      }), runs(200));
  }, timeoutFor(200, 3));

  it('frames a lone mark wherever it is, centered on it', () => {
    const seen = tally();
    fc.assert(fc.property(anyPose, measured, (pose, d) => {
      fc.pre(Number.isFinite(pose.x + pose.width / 2) && Number.isFinite(pose.y + pose.height / 2));
      const v = computeFitView(sceneOf([pose]), d, 'scene', descriptor);
      expect(finiteView(v)).toBe(true);
      if (pose.width === 0 && pose.height === 0) return;
      const c = viewScreenToWorld(v, { x: d.width / 2, y: d.height / 2 });
      expect(near(c.x, pose.x + pose.width / 2, Math.abs(pose.x) + pose.width + d.width / v.scale.x)).toBe(true);
      expect(near(c.y, pose.y + pose.height / 2, Math.abs(pose.y) + pose.height + d.height / v.scale.y)).toBe(true);
      if (Math.abs(pose.x) + Math.abs(pose.y) > 1e308) seen.count('far');
    }), runs(300));
    seen.atLeast('far', 10);
  }, timeoutFor(300, 3));

  it('frames a world rect as the scene fit frames a mark at that rect', () => {
    fc.assert(fc.property(anyPose, dims, (rect, d) => {
      // A union of one rect reads its far edges back, so it is that rect only where they round-trip.
      fc.pre(rect.x + rect.width - rect.x === rect.width && rect.y + rect.height - rect.y === rect.height);
      const world = computeFitView(sceneOf([]), d, { kind: 'world', rect }, descriptor);
      expect(finiteView(normalizeView(world))).toBe(true);
      expect(world).toEqual(computeFitView(sceneOf([rect]), d, 'scene', descriptor));
    }), runs(300));
  }, timeoutFor(300, 3));
});

describe('minimap mapping and indicator, property', () => {
  it('round-trips a minimap point through the world and back', () => {
    fc.assert(fc.property(fc.array(nearPose, { minLength: 1, maxLength: 4 }), measured, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
      (poses, d, u, w) => {
        const fit = computeFitView(sceneOf(poses), d, 'scene', descriptor);
        const s = { x: u * d.width, y: w * d.height };
        const back = viewWorldToScreen(fit, viewScreenToWorld(fit, s));
        expect(back.x).toBeCloseTo(s.x, 4);
        expect(back.y).toBeCloseTo(s.y, 4);
      }), runs(300));
  }, timeoutFor(300, 3));

  it('draws the indicator over the main view\'s world rect, its stroke in CSS px at any fit scale', () => {
    fc.assert(fc.property(view, measured, view, fc.double({ min: 0.5, max: 8, noNaN: true }), (main, d, fit, px) => {
      const cmd = computeIndicatorCommand(main, d, { width: px, dash: [2, 3] }, fit);
      expect(cmd.path).toEqual({ kind: 'rect', ...viewportWorldRect(main, d) });
      expect((cmd.stroke!.width as number) * fit.scale.x).toBeCloseTo(px, 9);
      const dash = cmd.stroke!.dash!;
      expect(dash[0]! * fit.scale.x).toBeCloseTo(2, 9);
      expect(dash.every(Number.isFinite)).toBe(true);
    }), runs(300));
  }, timeoutFor(300, 1));
});

describe('minimap actions, property', () => {
  const MODS = { alt: false, ctrl: false, meta: false, shift: false };

  it('a press centers the main view on the pressed point, keeping its scale, and the indicator lands there', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(nearPose, { minLength: 1, maxLength: 4 }), measured, view, measured, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
      (poses, d, start, host, u, w) => {
        const fit = computeFitView(sceneOf(poses), d, 'scene', descriptor);
        const s = { x: u * d.width, y: w * d.height };
        const world = viewScreenToWorld(fit, s);
        let main = start;
        const root = rootOf(() => main, (v) => { main = v; }, host);
        const action = minimapCenterAction();
        if (action.invoker?.timing !== 'immediate') throw new Error('not immediate');
        action.invoker.run({ rootView: root } as unknown as ActionDeps, { world });
        expect(main.scale).toEqual(start.scale);
        expect(finiteView(main)).toBe(true);
        const c = viewWorldToScreen(main, world);
        expect(near(c.x, host.width / 2, Math.abs(world.x) * main.scale.x)).toBe(true);
        expect(near(c.y, host.height / 2, Math.abs(world.y) * main.scale.y)).toBe(true);
        const rect = viewportWorldRect(main, host);
        const mid = viewWorldToScreen(fit, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
        if (Math.abs(world.x) < 1e6 && Math.abs(world.y) < 1e6 && main.scale.x > 1e-3 && main.scale.y > 1e-3 && fit.scale.x < 1e6) {
          expect(mid.x).toBeCloseTo(s.x, 3);
          expect(mid.y).toBeCloseTo(s.y, 3);
          seen.count('indicator');
        }
      }), runs(300));
    seen.atLeast('indicator', 100);
  }, timeoutFor(300, 3));

  it('a drag keeps the main view centered on the pointer', () => {
    fc.assert(fc.property(view, measured, fc.array(fc.record({ x: anyFinite, y: anyFinite }), { minLength: 1, maxLength: 5 }), (start, host, moves) => {
      let main = start;
      const root = rootOf(() => main, (v) => { main = v; }, host);
      const deps = { rootView: root } as unknown as ActionDeps;
      const inv = minimapPanAction().invoker;
      if (inv?.timing !== 'ongoing') throw new Error('not ongoing');
      const at = (p: { x: number; y: number }): InvocationCtx => ({
        world: p, screen: p, modifiers: MODS, deps, drag: { start: moves[0]!, current: p, delta: { x: 0, y: 0 } },
      });
      const handle = inv.start(at(moves[0]!), undefined);
      for (const p of moves) {
        handle.onMove?.(at(p));
        expect(finiteView(main)).toBe(true);
        const c = viewWorldToScreen(main, p);
        expect(near(c.x, host.width / 2, Math.abs(p.x) * main.scale.x)).toBe(true);
        expect(near(c.y, host.height / 2, Math.abs(p.y) * main.scale.y)).toBe(true);
      }
      handle.onEnd?.(at(moves.at(-1)!), 'commit');
      expect(main.scale).toEqual(start.scale);
    }), runs(300));
  }, timeoutFor(300, 2));

  it('a wheel zoom keeps the point under the cursor where it was, and stays finite', () => {
    const seen = tally();
    fc.assert(fc.property(fc.record({ x: fc.double({ min: -1e4, max: 1e4, noNaN: true }), y: fc.double({ min: -1e4, max: 1e4, noNaN: true }), scale: fc.record({ x: scale, y: scale }) }),
      measured, fc.record({ x: fc.double({ min: -1e4, max: 1e4, noNaN: true }), y: fc.double({ min: -1e4, max: 1e4, noNaN: true }) }),
      fc.oneof(fc.double({ min: -500, max: 500, noNaN: true }), fc.constantFrom(-1e308, 1e308, 1, -1)), (start, host, world, deltaY) => {
        let main = start;
        const root = rootOf(() => main, (v) => { main = v; }, host);
        const inv = minimapZoomAction().invoker;
        if (inv?.timing !== 'immediate') throw new Error('not immediate');
        const before = viewWorldToScreen(main, world);
        inv.run({ rootView: root } as unknown as ActionDeps, { world, deltaY });
        expect(finiteView(main)).toBe(true);
        const after = viewWorldToScreen(main, world);
        const mag = Math.abs(before.x) + Math.abs(before.y) + 1;
        expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1e-6 * mag);
        expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1e-6 * mag);
        if (deltaY !== 0 && main.scale.x !== start.scale.x) seen.count('zoomed');
      }), runs(300));
    seen.atLeast('zoomed', 100);
  }, timeoutFor(300, 1));
});
