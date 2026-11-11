/**
 * The 3D pose descriptor: a screen drag carries the point under a node's anchor with the pointer on the node's own
 * level, at its height; an identity remap changes nothing and any remap keeps the depth; and a screen box read back
 * as a pose sits at its template's depth and covers that box.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { IDENTITY_POSE_COMPOSITION, createScene } from '@weasel-js/core';
import { dot, intersectRayPlane, normalize, pointOnRay, sub, add, type Vec3 } from '@weasel-js/geom/3d';
import { cameraEye, createCamera } from './camera';
import { createPoseDescriptor } from './deps';
import { isFinite3, maxDiff3, pose, runs, tally, timeoutFor, v3, viewport } from './pbt.fixture';
import type { Pose3 } from './pose3';
import { projectPoint, rayAt, type Viewport3d } from './project';
import type { World3d } from './world';

const RUNS = 300;
const T = timeoutFor(RUNS, 3);
const UP: Vec3 = { x: 0, y: 1, z: 0 };

function worldOf(vp: Viewport3d): World3d<object, 'solids'> {
  const scene = createScene<object, 'solids', Pose3>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'solids' }] });
  return { scene, viewport: () => vp };
}

const forward = (vp: Viewport3d): Vec3 => normalize(sub(vp.camera.target, cameraEye(vp.camera)));
const depthOf = (vp: Viewport3d, p: Vec3): number => dot(sub(p, cameraEye(vp.camera)), forward(vp));

/** A pose standing in front of the camera, near its target. */
const posed = fc.tuple(viewport, pose(), v3(5)).map(([vp, p, off]) => ({ vp, p: { ...p, position: add(vp.camera.target, off) } }));
const d = fc.double({ min: -300, max: 300, noNaN: true });

describe('createPoseDescriptor, property', () => {
  it('drags the point under the anchor with the pointer on the node\'s level, keeping its height', () => {
    const seen = tally();
    fc.assert(fc.property(posed, d, d, ({ vp, p }, dx, dy) => {
      const desc = createPoseDescriptor(worldOf(vp));
      const out = desc.translate!(p, dx, dy);
      expect(isFinite3(out.position)).toBe(true);
      expect(out.position.y).toBe(p.position.y);
      expect(out.rotation).toEqual(p.rotation);
      expect(out.scale).toEqual(p.scale);
      if (dx === 0 && dy === 0) expect(out.position).toEqual(p.position);
      const b = desc.getBounds(p);
      const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      const ray = rayAt(vp, from);
      const t = ray && intersectRayPlane(ray, UP, p.position.y);
      if (!ray || t === null || out.position === p.position) return;
      const moved = add(pointOnRay(ray, t), sub(out.position, p.position));
      const s = projectPoint(moved, vp);
      if (!s) return;
      seen.count('dragged');
      const tol = 1e-5 * (1 + vp.width + vp.height + Math.abs(dx) + Math.abs(dy));
      expect(Math.abs(s.x - (from.x + dx))).toBeLessThanOrEqual(tol);
      expect(Math.abs(s.y - (from.y + dy))).toBeLessThanOrEqual(tol);
    }), runs(RUNS));
    seen.atLeast('dragged', 25);
  }, T);

  it('leaves a pose where it was under a remap from a box to itself (shrunk)', () => {
    const vp: Viewport3d = { camera: createCamera({ distance: 0.5, fov: 0.2 }), width: 20, height: 20, originY: -223 };
    const p: Pose3 = { position: { x: 0, y: 0, z: 0 }, rotation: [0, 0, 0, 1], scale: { x: 0.1, y: 0.1, z: 0.1 } };
    const box = { x: 0, y: 299.99999999494474, width: 0, height: 0 };
    expect(createPoseDescriptor(worldOf(vp)).remapBounds!(p, box, box).position).toEqual(p.position);
  });

  it('changes nothing under an identity remap, and keeps the depth under any', () => {
    const rect = fc.record({ x: d, y: d, width: fc.double({ min: 0, max: 500, noNaN: true }), height: fc.double({ min: 0, max: 500, noNaN: true }) });
    fc.assert(fc.property(posed, rect, rect, ({ vp, p }, src, dst) => {
      const desc = createPoseDescriptor(worldOf(vp));
      const same = desc.remapBounds!(p, src, src);
      expect(maxDiff3(same.position, p.position)).toBe(0);
      expect(same.scale).toEqual(p.scale);
      const out = desc.remapBounds!(p, src, dst);
      expect(isFinite3(out.position) && isFinite3(out.scale)).toBe(true);
      const depth = depthOf(vp, p.position);
      expect(Math.abs(depthOf(vp, out.position) - depth)).toBeLessThanOrEqual(1e-9 * (1 + Math.abs(depth) + Math.abs(out.position.x) + Math.abs(out.position.y) + Math.abs(out.position.z)));
    }), runs(RUNS));
  }, T);

  it('reads a screen box as a pose at its template\'s depth whose box covers it', () => {
    const seen = tally();
    const frac = fc.double({ min: 0.05, max: 0.95, noNaN: true });
    fc.assert(fc.property(posed, frac, frac, frac, frac, ({ vp, p }, a, b, c, e) => {
      const ox = vp.originX ?? 0;
      const oy = vp.originY ?? 0;
      const bounds = {
        x: ox + Math.min(a, b) * vp.width, y: oy + Math.min(c, e) * vp.height,
        width: Math.abs(a - b) * vp.width, height: Math.abs(c - e) * vp.height,
      };
      if (depthOf(vp, p.position) <= vp.camera.near * 2) return;
      const desc = createPoseDescriptor(worldOf(vp));
      const out = desc.fromBounds!(bounds, p);
      if (out === p) return;
      seen.count('read');
      expect(isFinite3(out.position) && isFinite3(out.scale)).toBe(true);
      const depth = depthOf(vp, p.position);
      expect(Math.abs(depthOf(vp, out.position) - depth)).toBeLessThanOrEqual(1e-9 * (1 + depth + Math.abs(out.position.x) + Math.abs(out.position.y) + Math.abs(out.position.z)));
      const back = desc.getBounds(out);
      const nearSide = depth - Math.max(out.scale.x, out.scale.y, out.scale.z);
      if (nearSide <= vp.camera.near) return;
      seen.count('covered');
      const tol = 1e-6 * (1 + vp.width + vp.height + Math.abs(ox) + Math.abs(oy));
      expect(back.x).toBeLessThanOrEqual(bounds.x + tol);
      expect(back.y).toBeLessThanOrEqual(bounds.y + tol);
      expect(back.x + back.width).toBeGreaterThanOrEqual(bounds.x + bounds.width - tol);
      expect(back.y + back.height).toBeGreaterThanOrEqual(bounds.y + bounds.height - tol);
    }), runs(RUNS));
    seen.atLeast('read', 100);
    seen.atLeast('covered', 50);
  }, T);
});
