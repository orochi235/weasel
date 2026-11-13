/**
 * A 3D snap session through `createSnap`: a point gesture lands on a ground grid point beside the pointer's cast
 * and stays there when asked again, never moves the pointer past its reach to a box, and passes it through when
 * suspended; a move keeps some probe of what it drags within reach of where the pointer put it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { IDENTITY_POSE_COMPOSITION, createScene, type NodeId } from '@weasel-js/core';
import { add, intersectRayPlane, pointOnRay, sub, type Vec3 } from '@weasel-js/geom/3d';
import { createSnap } from '../deps';
import { coord, paneAt, paneFractions, pose, runs, tally, timeoutFor, v3, viewport } from '../pbt.fixture';
import { aabbOfPose, type Pose3 } from '../pose3';
import { projectPoint, rayAt, rectOf, viewProjectionOf, type Viewport3d } from '../project';
import { projectAabbToScreen } from '../screen';
import type { Scene3d, World3d } from '../world';
import { boxProbes } from './probes3d';
import { alignPlaneSource, boxSnapSource, groundGridSource } from './sources';

const RUNS = 150;
const T = timeoutFor(RUNS, 20);
const FREE = { suspend: false, constrain: false };
const UP: Vec3 = { x: 0, y: 1, z: 0 };

type Point = { x: number; y: number };
type W = World3d<object, 'solids'>;

function worldOf(poses: readonly Pose3[], vp: Viewport3d): { world: W; ids: NodeId[] } {
  const scene: Scene3d<object, 'solids'> = createScene<object, 'solids', Pose3>({
    composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'solids' }],
    initial: poses.map((p) => ({ kind: 'mark' as const, layer: 'solids' as const, pose: p, data: {} })),
  });
  return { world: { scene, viewport: () => vp }, ids: [...scene.renderOrder()] };
}

function cast(vp: Viewport3d, s: Point, offset: number): Vec3 | null {
  const ray = rayAt(vp, s);
  const t = ray && intersectRayPlane(ray, UP, offset);
  return ray && t !== null ? pointOnRay(ray, t) : null;
}

const gap = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** A pane whose camera looks down at its target on the ground from outside what stands there. */
const groundView: fc.Arbitrary<Viewport3d> = fc.tuple(viewport, fc.double({ min: 10, max: 60, noNaN: true }), fc.double({ min: 0.15, max: 1.3, noNaN: true }))
  .map(([vp, distance, pitch]) => ({ ...vp, camera: { ...vp.camera, target: { ...vp.camera.target, y: 0 }, distance, pitch } }));

const size = fc.double({ min: 0.3, max: 2, noNaN: true });
const sizes = fc.tuple(size, size, size).map(([x, y, z]) => ({ x, y, z }));

/** Boxes about the camera's target, standing within `rise` of the ground. */
function sceneOf(rise: number, minLength: number) {
  return fc.tuple(groundView, fc.array(fc.tuple(pose(sizes, 0), v3(4), coord(rise)), { minLength, maxLength: 5 }))
    .map(([vp, items]) => ({
      vp,
      poses: items.map(([p, off, y]) => ({ ...p, position: add(vp.camera.target, { x: off.x, y, z: off.z }) })),
    }));
}

const reachPx = fc.double({ min: 1, max: 40, noNaN: true });
const step = fc.constantFrom(0.25, 0.5, 1, 2.5, 10);

describe('a 3D point gesture, property', () => {
  it('lands on a ground grid point beside the pointer\'s cast, and stays there asked again', () => {
    const seen = tally();
    fc.assert(fc.property(groundView, paneFractions(), step, (vp, f, s) => {
      const { world } = worldOf([], vp);
      const snap = createSnap(world, { sources: [groundGridSource({ world, step: s })] });
      const p = paneAt(vp, f);
      const raw = cast(vp, p, 0);
      const out = snap.begin({ gesture: 'point', press: p }).at(p, FREE);
      expect(Number.isFinite(out.point.x) && Number.isFinite(out.point.y)).toBe(true);
      if (raw === null || gap(out.point, p) === 0) {
        seen.count('passed through');
        return;
      }
      const landed = cast(vp, out.point, 0);
      expect(landed).not.toBeNull();
      seen.count('snapped');
      const scale = 1 + Math.abs(raw.x) + Math.abs(raw.z);
      // A grid line on either side of the cast: which is nearer is measured on screen, where perspective can reorder them.
      for (const axis of ['x', 'z'] as const) {
        const tol = 1e-6 * scale;
        expect(Math.abs(landed![axis] / s - Math.round(landed![axis] / s)) * s).toBeLessThanOrEqual(tol);
        expect(Math.abs(landed![axis] - raw[axis])).toBeLessThanOrEqual(s + tol);
      }
      const again = snap.begin({ gesture: 'point', press: out.point }).at(out.point, FREE);
      expect(gap(again.point, out.point)).toBeLessThanOrEqual(1e-6 * (1 + vp.width + vp.height));
    }), runs(RUNS));
    seen.atLeast('snapped', 50);
  }, T);

  it('never moves the pointer past its reach to a box, and passes it through suspended', () => {
    const seen = tally();
    const aim = fc.record({ corner: fc.integer({ min: 0, max: 8 }), jitter: fc.tuple(fc.double({ min: -2, max: 2, noNaN: true }), fc.double({ min: -2, max: 2, noNaN: true })) });
    fc.assert(fc.property(sceneOf(0.5, 1), paneFractions(), reachPx, aim, ({ vp, poses }, f, reach, { corner, jitter }) => {
      const { world } = worldOf(poses, vp);
      const snap = createSnap(world, { sources: [boxSnapSource(world), alignPlaneSource(world)], reachPx: reach });
      const near = poses.length > 0 ? projectPoint(boxProbes(aabbOfPose(poses[0]!))[corner]!.at, vp) : null;
      const p = near ? { x: near.x + jitter[0] * reach, y: near.y + jitter[1] * reach } : paneAt(vp, f);
      const out = snap.begin({ gesture: 'point', press: p }).at(p, FREE);
      expect(Number.isFinite(out.point.x) && Number.isFinite(out.point.y)).toBe(true);
      const moved = gap(out.point, p);
      expect(moved).toBeLessThanOrEqual(reach * (1 + 1e-6) + 1e-6 * (vp.width + vp.height));
      seen.count(out.held ? 'held' : 'free');
      const suspended = snap.begin({ gesture: 'point', press: p }).at(p, { suspend: true, constrain: false });
      expect(suspended.held).toBe(false);
      expect(gap(suspended.point, p)).toBeLessThanOrEqual(1e-6 * (1 + vp.width + vp.height));
    }), runs(RUNS));
    seen.atLeast('held', 15);
    seen.atLeast('free', 15);
  }, T);
});

describe('a 3D move, property', () => {
  it('keeps some probe of what it drags within reach of where the pointer put it, on its own plane', () => {
    const seen = tally();
    const jitter = fc.oneof(v3(0.3), v3(3));
    fc.assert(fc.property(sceneOf(4, 2), fc.integer({ min: 0, max: 4 }), jitter, reachPx, ({ vp, poses }, pick, off, reach) => {
      const { world, ids } = worldOf(poses, vp);
      const i = pick % ids.length;
      const id = ids[i]!;
      const node = world.scene.get(id)!;
      const push = add(sub(poses[(i + 1) % poses.length]!.position, node.pose.position), off);
      const box = aabbOfPose(node.pose);
      const screenBox = projectAabbToScreen(box, viewProjectionOf(vp), rectOf(vp));
      if (!screenBox) return;
      const press = { x: screenBox.x + screenBox.width / 2, y: screenBox.y + screenBox.height / 2 };
      const height = node.pose.position.y;
      const anchor = cast(vp, press, height);
      if (!anchor) return;
      const target = projectPoint(add(anchor, { x: push.x, y: 0, z: push.z }), vp);
      if (!target) return;
      const snap = createSnap(world, { sources: [boxSnapSource(world), alignPlaneSource(world)], reachPx: reach });
      const out = snap.begin({ gesture: 'move', ids: [id], press }).at(target, FREE);
      expect(Number.isFinite(out.point.x) && Number.isFinite(out.point.y)).toBe(true);
      if (!out.held) {
        seen.count('free');
        return;
      }
      const at = (s: Point) => cast(vp, s, height);
      const raw = at(target);
      const snapped = at(out.point);
      if (!raw || !snapped) return;
      seen.count('held');
      const d0 = sub(raw, anchor);
      const d = sub(snapped, anchor);
      const scale = 1 + Math.abs(anchor.x) + Math.abs(anchor.z) + Math.abs(d.x) + Math.abs(d.z);
      expect(Math.abs(d.y)).toBeLessThanOrEqual(1e-6 * scale);
      const moves = boxProbes(box).flatMap((q) => {
        const a = projectPoint(add(q.at, d0), vp);
        const b = projectPoint(add(q.at, d), vp);
        return a && b ? [gap(a, b)] : [];
      });
      expect(Math.min(...moves)).toBeLessThanOrEqual(reach * (1 + 1e-3) + 1e-3);
    }), runs(RUNS));
    seen.atLeast('held', 50);
  }, T);
});
