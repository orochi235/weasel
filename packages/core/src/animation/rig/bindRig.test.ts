import { describe, expect, it } from 'vitest';
import { createScene } from '../../core/scene/scene';
import { effectivePose } from '../../core/scene/effectivePose';
import type { NodeId, RectPose } from '../../core/scene/types';
import { mat3 } from '../../renderer/math/mat3';
import { bindRig } from './bindRig';
import type { Skeleton } from './types';

const LAYERS = [{ id: 'main' as const }];

// A two-bone arm: shoulder at (100, 100) pointing +x, elbow 50 along it.
const ARM: Skeleton = {
  joints: [
    { name: 'upper', parent: null, bind: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 } },
    { name: 'lower', parent: 'upper', bind: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
  ],
};

/** Bone rects laid over the bind pose: each 50 long, 10 wide, from its joint along +x. */
function armScene() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
  const upper = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 95, width: 50, height: 10 }, data: {} });
  const lower = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 150, y: 95, width: 50, height: 10 }, data: {} });
  return { scene, upper, lower };
}

const where = (scene: ReturnType<typeof armScene>['scene'], id: NodeId) => effectivePose(scene, scene.get(id)!);

const close = (actual: RectPose, expected: RectPose) => {
  expect(actual.x).toBeCloseTo(expected.x, 4);
  expect(actual.y).toBeCloseTo(expected.y, 4);
  expect(actual.width).toBeCloseTo(expected.width, 4);
  expect(actual.height).toBeCloseTo(expected.height, 4);
  expect(actual.rotation ?? 0).toBeCloseTo(expected.rotation ?? 0, 4);
};

describe('bindRig', () => {
  it('leaves the bound nodes where they are at the bind pose', () => {
    const { scene, upper, lower } = armScene();
    const rig = bindRig({ scene, skeleton: ARM, bindings: { upper, lower } });
    rig.pose({});
    close(where(scene, upper), { x: 100, y: 95, width: 50, height: 10 });
    close(where(scene, lower), { x: 150, y: 95, width: 50, height: 10 });
  });

  it('carries each node rigidly with its joint, children through their parents', () => {
    const { scene, upper, lower } = armScene();
    const rig = bindRig({ scene, skeleton: ARM, bindings: { upper, lower } });
    rig.pose({ upper: { rotation: Math.PI / 2 } });
    // Upper arm now hangs straight down from (100, 100): center (100, 125).
    close(where(scene, upper), { x: 75, y: 120, width: 50, height: 10, rotation: Math.PI / 2 });
    // The elbow moved to (100, 150); the forearm hangs below it: center (100, 175).
    close(where(scene, lower), { x: 75, y: 170, width: 50, height: 10, rotation: Math.PI / 2 });
  });

  it('writes through overrides: no history, document poses untouched', () => {
    const { scene, upper, lower } = armScene();
    const before = scene.historyEntries().length;
    const version = scene.getVersion();
    const rig = bindRig({ scene, skeleton: ARM, bindings: { upper, lower } });
    for (let i = 0; i < 10; i++) rig.pose({ upper: { rotation: i * 0.1 } });
    expect(scene.historyEntries().length).toBe(before);
    expect(scene.getVersion()).toBe(version);
    expect(scene.get(lower)!.pose).toEqual({ x: 150, y: 95, width: 50, height: 10 });
    expect(scene.overrides.has(lower)).toBe(true);
  });

  it('places the rig by a root transform, mirrored roots included', () => {
    const { scene, upper } = armScene();
    const rig = bindRig({ scene, skeleton: ARM, bindings: { upper } });
    // Mirror about x = 100: the arm now points -x from the same shoulder.
    const mirror = mat3.multiply(mat3.translated(mat3.identity(), 100, 0), mat3.scaled(mat3.identity(), -1, 1));
    rig.pose({}, mat3.multiply(mirror, mat3.translated(mat3.identity(), -100, 0)));
    const p = where(scene, upper);
    expect(p.x + p.width / 2).toBeCloseTo(75, 4);
    expect(p.y + p.height / 2).toBeCloseTo(100, 4);
    expect(Math.abs(Math.cos(p.rotation ?? 0))).toBeCloseTo(1, 4);
  });

  it('binds several nodes to one joint', () => {
    const { scene, upper } = armScene();
    const badge = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 120, y: 90, width: 4, height: 4 }, data: {} });
    const rig = bindRig({ scene, skeleton: ARM, bindings: { upper: [upper, badge] } });
    rig.pose({ upper: { x: 10 } });
    close(where(scene, badge), { x: 130, y: 90, width: 4, height: 4 });
  });

  it('bakes the current frame into the document as one undo entry, and drops the overrides', () => {
    const { scene, upper, lower } = armScene();
    const rig = bindRig({ scene, skeleton: ARM, bindings: { upper, lower } });
    rig.pose({ upper: { y: 20 } });
    const before = scene.historyEntries().length;
    rig.bake('strike a pose');
    expect(scene.historyEntries().length).toBe(before + 1);
    expect(scene.overrides.has(upper)).toBe(false);
    close(scene.get(lower)!.pose, { x: 150, y: 115, width: 50, height: 10 });
    // Poses stay relative to the bind-time rest, so the next frame does not compound.
    rig.pose({ upper: { y: 20 } });
    close(where(scene, lower), { x: 150, y: 115, width: 50, height: 10 });
  });

  it('release returns the nodes to their document poses', () => {
    const { scene, upper } = armScene();
    const rig = bindRig({ scene, skeleton: ARM, bindings: { upper } });
    rig.pose({ upper: { x: 30 } });
    rig.release();
    expect(scene.overrides.has(upper)).toBe(false);
    close(where(scene, upper), { x: 100, y: 95, width: 50, height: 10 });
  });

  it('hands a custom apply the joint world and the bind-time rest', () => {
    const { scene, upper } = armScene();
    const seen: string[] = [];
    const rig = bindRig({
      scene, skeleton: ARM, bindings: { upper },
      apply: (world, ctx) => {
        seen.push(ctx.joint);
        const [x, y] = mat3.apply(world, 0, 0);
        return { ...ctx.rest, x, y };
      },
    });
    rig.pose({ upper: { x: 7 } });
    expect(seen).toEqual(['upper']);
    close(where(scene, upper), { x: 107, y: 100, width: 50, height: 10 });
  });

  it('refuses a joint the skeleton lacks, or a node the scene lacks', () => {
    const { scene, upper } = armScene();
    expect(() => bindRig({ scene, skeleton: ARM, bindings: { wrist: upper } })).toThrow(/wrist/);
    expect(() => bindRig({ scene, skeleton: ARM, bindings: { upper: 'nope' as NodeId } })).toThrow(/nope/);
  });

  it('exposes the last resolved joint transforms', () => {
    const { scene, upper } = armScene();
    const rig = bindRig({ scene, skeleton: ARM, bindings: { upper } });
    rig.pose({ upper: { x: 5 } });
    const [x, y] = mat3.apply(rig.world().get('lower')!, 0, 0);
    expect([x, y]).toEqual([155, 100]);
  });
});
