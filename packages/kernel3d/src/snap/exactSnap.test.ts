/**
 * A 3D snap stores the coordinate it snapped to, not that coordinate read back
 * off a screen point: core's move and insert carry the session's landing to
 * the commit, so a grid line at 0.5 is stored as 0.5.
 */
import { describe, expect, it } from 'vitest';
import {
  IDENTITY_POSE_COMPOSITION, createScene, insertAction, moveAction, placeAction,
  type ImmediateInvoker, type InvocationCtx, type NodeId, type OngoingInvoker,
} from '@weasel-js/core';
import { add, type Vec3 } from '@weasel-js/geom/3d';
import { createCamera } from '../camera';
import { createPoseDescriptor, createSnap } from '../deps';
import { createInsert, type Footprint } from '../insert';
import { aabbOfPose, pose3, type Pose3 } from '../pose3';
import { projectPoint, type Viewport3d } from '../project';
import type { Scene3d, World3d } from '../world';
import { groundGridSource } from './sources';

type W = World3d<object, 'solids'>;
const KEYS = { alt: false, ctrl: false, meta: false, shift: false };
const Z_UP: Vec3 = { x: 0, y: 0, z: 1 };

function worldOf(poses: readonly Pose3[], up?: Vec3): { world: W; ids: NodeId[] } {
  const camera = createCamera({ distance: 12, pitch: 0.5, yaw: 0.4, target: { x: 0.5, y: 0.5, z: 0.5 } });
  const vp: Viewport3d = { camera, width: 800, height: 600 };
  const scene: Scene3d<object, 'solids'> = createScene<object, 'solids', Pose3>({
    composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'solids' }],
    initial: poses.map((pose) => ({ kind: 'mark' as const, layer: 'solids' as const, pose, data: {} })),
  });
  return { world: { scene, viewport: () => vp, ...(up ? { up } : {}) }, ids: [...scene.renderOrder()] };
}

/** Drag `id` with core's move action so the point under its center goes `by` in the world. */
function moveBy(world: W, id: NodeId, by: Vec3): void {
  const vp = { ...world.viewport(), ...(world.up ? { up: world.up } : {}) };
  const center = world.scene.get(id)!.pose.position;
  const press = projectPoint(center, vp)!;
  const to = projectPoint(add(center, by), vp)!;
  const deps = {
    operands: { get: () => [id], set: () => {} },
    scene: world.scene,
    poseDescriptor: createPoseDescriptor(world),
    snap: createSnap(world, { sources: [groundGridSource({ world, step: 0.5 })] }),
  };
  const base = { world: press, screen: press, modifiers: KEYS, deps };
  const drag = { start: press, current: to, delta: { x: to.x - press.x, y: to.y - press.y } };
  const handle = (moveAction.invoker as OngoingInvoker).start(base as unknown as InvocationCtx, undefined);
  handle.onMove!({ ...base, world: to, drag } as unknown as InvocationCtx);
  handle.onEnd!({ ...base, world: to, drag } as unknown as InvocationCtx, 'commit');
}

describe('a 3D move snapped to the ground grid', () => {
  it('stores the grid line itself on a z-up scene', () => {
    // A unit box resting on the ground, its corners a little off the lines at 0.
    const { world, ids } = worldOf([pose3({ x: 0.75, y: 0.75, z: 0.5 })], Z_UP);
    moveBy(world, ids[0]!, { x: -0.28, y: -0.21, z: 0 });
    const { position } = world.scene.get(ids[0]!)!.pose;
    expect(position.x).toBe(0.5);
    expect(position.y).toBe(0.5);
    expect(position.z).toBe(0.5);
    expect(aabbOfPose(world.scene.get(ids[0]!)!.pose).min.y).toBe(0);
  });

  it('stores the grid line itself on a y-up scene', () => {
    const { world, ids } = worldOf([pose3({ x: 0.75, y: 0.5, z: 0.75 })]);
    moveBy(world, ids[0]!, { x: 0.23, y: 0, z: -0.19 });
    const { position } = world.scene.get(ids[0]!)!.pose;
    expect(position.x).toBe(1);
    expect(position.y).toBe(0.5);
    expect(position.z).toBe(0.5);
  });
});

describe('a 3D insert snapped to the ground grid', () => {
  function inserted(up: Vec3 | undefined, from: Vec3, to: Vec3): Footprint {
    const { world } = worldOf([], up);
    const vp = { ...world.viewport(), ...(up ? { up } : {}) };
    let minted: Footprint | null = null;
    const deps = {
      insert: createInsert({ world, mint: (f) => ((minted = f), 'n' as NodeId) }),
      snap: createSnap(world, { sources: [groundGridSource({ world, step: 0.5 })] }),
    };
    const ctx = (p: Vec3): InvocationCtx => {
      const s = projectPoint(p, vp)!;
      return { world: s, screen: s, modifiers: KEYS, deps };
    };
    const handle = (insertAction.invoker as OngoingInvoker).start(ctx(from), undefined);
    handle.onMove!(ctx(to));
    handle.onEnd!(ctx(to), 'commit');
    return minted!;
  }

  it('spans the grid points a drag snapped to exactly, on a z-up scene', () => {
    const f = inserted(Z_UP, { x: 0.47, y: 0.53, z: 0 }, { x: 1.54, y: 2.03, z: 0 });
    expect(f.center).toEqual({ x: 1, y: 1.25, z: 0 });
    expect(f.width).toBe(1);
    expect(f.depth).toBe(1.5);
  });

  it('spans the grid points a drag snapped to exactly, on a y-up scene', () => {
    const f = inserted(undefined, { x: -0.52, y: 0, z: 0.46 }, { x: 0.49, y: 0, z: 1.53 });
    expect(f.center).toEqual({ x: 0, y: 0, z: 1 });
    expect(f.width).toBe(1);
    expect(f.depth).toBe(1);
  });

  it('centers a click on the grid point it snapped to exactly', () => {
    const { world } = worldOf([], Z_UP);
    const vp = { ...world.viewport(), up: Z_UP };
    let minted: Footprint | null = null;
    const deps = {
      insert: createInsert({ world, mint: (f) => ((minted = f), 'n' as NodeId) }),
      snap: createSnap(world, { sources: [groundGridSource({ world, step: 0.5 })] }),
    };
    const click = projectPoint({ x: 1.53, y: -0.48, z: 0 }, vp)!;
    (placeAction.invoker as ImmediateInvoker).run(deps as never, {
      kind: 'rect', size: { width: 40, height: 30 }, world: { x: click.x, y: click.y },
    });
    const f = minted as Footprint | null;
    expect(f!.center.x).toBe(1.5);
    expect(f!.center.y).toBe(-0.5);
  });
});
