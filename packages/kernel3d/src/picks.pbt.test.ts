/**
 * Picks through view changes, stateful: a scene of boxes, some with ids `Object.prototype` holds, through long runs
 * of turns, pans, dollies about a point, pane resizes and moves, node moves, removals, additions, and the camera
 * and the scene carried millions of units out together. After every
 * step, the pointer over where a node's center draws picks a node the ray meets no further than that center, inside
 * whose screen box the point lies, and a marquee over the whole pane selects every node whose screen box meets it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createScene, type NodeId } from '@weasel-js/core';
import { add, aabbAround, intersectRayAabb, len, sub, type Aabb, type Vec3 } from '@weasel-js/geom/3d';
import { rectsOverlap } from '@weasel-js/geom';
import { cameraEye, dollyToward, orbitBy, panBy } from './camera';
import { POSE3_COMPOSITION } from './composePose3';
import { createAreaSelect, createNodeAtPoint, createPickEvery, screenBoxOf } from './deps';
import { camera, runs, tally, timeoutFor, v3 } from './pbt.fixture';
import type { Pose3 } from './pose3';
import { projectPoint, rayAt, rectOf, type Viewport3d } from './project';
import type { World3d } from './world';

const RUNS = 120;
const T = timeoutFor(RUNS, 40);
const PROTO_IDS = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];

type Data = { r: number };
type W = World3d<Data, 'solids'>;
type Cmd =
  | { t: 'orbit'; a: number; b: number }
  | { t: 'pan'; a: number; b: number }
  | { t: 'dolly'; k: number; fx: number; fy: number }
  | { t: 'pane'; width: number; height: number; ox: number; oy: number }
  | { t: 'moveNode'; i: number; by: Vec3 }
  | { t: 'remove'; i: number }
  | { t: 'add'; id: string | null; at: Vec3; r: number }
  | { t: 'travel'; by: Vec3 };

const unit = fc.double({ min: 0, max: 1, noNaN: true });
const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  fc.record({ t: fc.constant('orbit' as const), a: fc.double({ min: -3, max: 3, noNaN: true }), b: fc.double({ min: -1, max: 1, noNaN: true }) }),
  fc.record({ t: fc.constant('pan' as const), a: fc.double({ min: -300, max: 300, noNaN: true }), b: fc.double({ min: -300, max: 300, noNaN: true }) }),
  fc.record({ t: fc.constant('dolly' as const), k: fc.double({ min: 0.3, max: 3, noNaN: true }), fx: unit, fy: unit }),
  fc.record({ t: fc.constant('pane' as const), width: fc.integer({ min: 40, max: 1600 }), height: fc.integer({ min: 40, max: 1200 }), ox: fc.integer({ min: -300, max: 300 }), oy: fc.integer({ min: -300, max: 300 }) }),
  fc.record({ t: fc.constant('moveNode' as const), i: fc.nat(), by: v3(4) }),
  fc.record({ t: fc.constant('remove' as const), i: fc.nat() }),
  fc.record({ t: fc.constant('travel' as const), by: v3(1e7) }),
  fc.record({ t: fc.constant('add' as const), id: fc.oneof({ weight: 3, arbitrary: fc.constant(null) }, { weight: 1, arbitrary: fc.constantFrom(...PROTO_IDS) }), at: v3(8), r: fc.double({ min: 0.1, max: 2, noNaN: true }) }),
);

const poseAt = (at: Vec3): Pose3 => ({ position: at, rotation: [0, 0, 0, 1], scale: { x: 1, y: 1, z: 1 } });

function apply(world: W, vp: { current: Viewport3d }, c: Cmd): void {
  const { scene } = world;
  const ids = [...scene.renderOrder()];
  const v = vp.current;
  switch (c.t) {
    case 'orbit': vp.current = { ...v, camera: orbitBy(v.camera, c.a, c.b) }; break;
    case 'pan': vp.current = { ...v, camera: panBy(v.camera, c.a, c.b, v.height) }; break;
    case 'dolly': vp.current = { ...v, camera: dollyToward(v.camera, c.k, { x: c.fx * v.width, y: c.fy * v.height }, v) }; break;
    case 'pane': vp.current = { ...v, width: c.width, height: c.height, originX: c.ox, originY: c.oy }; break;
    case 'moveNode': {
      const id = ids[c.i % Math.max(1, ids.length)];
      if (id) scene.setPose(id, poseAt(add(scene.get(id)!.pose.position, c.by)));
      break;
    }
    case 'remove': {
      const id = ids[c.i % Math.max(1, ids.length)];
      if (id) scene.remove(id);
      break;
    }
    case 'travel':
      // The camera and everything in the scene carried far out together.
      vp.current = { ...v, camera: { ...v.camera, target: add(v.camera.target, c.by) } };
      for (const id of ids) scene.setPose(id, poseAt(add(scene.get(id)!.pose.position, c.by)));
      break;
    case 'add':
      if (c.id && scene.get(c.id as NodeId)) break;
      scene.add({ ...(c.id ? { id: c.id as NodeId } : {}), kind: 'mark', layer: 'solids', pose: poseAt(add(v.camera.target, c.at)), data: { r: c.r } });
      break;
  }
}

const boxOf = (node: { pose: Pose3; data: Data }): Aabb => aabbAround(node.pose.position, node.data.r);

describe('picks through view changes, stateful', () => {
  it('pick a node no further than the center drawn under the pointer, in its screen box, and marquee every one in the pane', () => {
    const seen = tally();
    fc.assert(fc.property(camera, fc.array(cmd, { minLength: 5, maxLength: 60 }), (c0, cmds) => {
      const scene = createScene<Data, 'solids', Pose3>({ composition: POSE3_COMPOSITION, systemLayers: [{ id: 'solids' }] });
      const vp = { current: { camera: c0, width: 800, height: 600 } as Viewport3d };
      const world: W = { scene, viewport: () => vp.current, bounds: (n) => boxOf(n) };
      const pick = createNodeAtPoint(world);
      const pickEvery = createPickEvery(world);
      let selected: NodeId[] = [];
      const area = createAreaSelect(world, { get: () => selected, set: (ids) => { selected = ids; } });
      for (const c of cmds) {
        apply(world, vp, c);
        const v = vp.current;
        const eye = cameraEye(v.camera);
        const pane = rectOf(v);
        const inPane = (s: { x: number; y: number }) => s.x >= pane.x && s.x <= pane.x + pane.width && s.y >= pane.y && s.y <= pane.y + pane.height;
        for (const id of scene.renderOrder()) {
          const node = scene.get(id)!;
          const box = boxOf(node);
          const center = node.pose.position;
          if (len(sub(center, eye)) <= node.data.r * 2 + v.camera.near * 2) continue;
          const s = projectPoint(center, v);
          if (!s || !inPane(s)) continue;
          const ray = rayAt(v, s)!;
          const own = intersectRayAabb(ray, box.min, box.max);
          if (own === null || own > 1) continue;
          seen.count(PROTO_IDS.includes(id) ? 'proto picked' : 'picked');
          const got = pick(s);
          if (Math.abs(center.x) + Math.abs(center.y) + Math.abs(center.z) > 1e5) seen.count('far');
          expect(got).not.toBeNull();
          expect(pickEvery(s)).toBe(got);
          const gotBox = boxOf(scene.get(got!)!);
          const t = intersectRayAabb(ray, gotBox.min, gotBox.max);
          expect(t).not.toBeNull();
          expect(t!).toBeLessThanOrEqual(own * (1 + 1e-9) + 1e-12);
          const sb = screenBoxOf(world, id, v)!;
          const tol = 1e-6 * (1 + Math.abs(sb.x) + Math.abs(sb.y) + sb.width + sb.height);
          expect(s.x).toBeGreaterThanOrEqual(sb.x - tol);
          expect(s.x).toBeLessThanOrEqual(sb.x + sb.width + tol);
          expect(s.y).toBeGreaterThanOrEqual(sb.y - tol);
          expect(s.y).toBeLessThanOrEqual(sb.y + sb.height + tol);
        }
        const want = [...scene.renderOrder()].filter((id) => {
          const sb = screenBoxOf(world, id, v);
          return sb !== null && rectsOverlap(sb, pane);
        });
        expect(area.hitTestArea(pane)).toEqual(want);
        if (want.length > 0) seen.count('marquee');
      }
    }), runs(RUNS));
    seen.atLeast('picked', 100);
    seen.atLeast('proto picked', 20);
    seen.atLeast('marquee', 100);
    seen.atLeast('far', 30);
  }, T);
});
