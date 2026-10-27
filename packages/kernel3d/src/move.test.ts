import { describe, expect, it } from 'vitest';
import {
  moveAction, moveNodesOps,
  type GeometryProjection, type InvocationCtx, type NodeId, type PoseChange,
} from '@weasel-js/core';
import type { Affine } from '@weasel-js/geom';
import { createCamera } from './camera';
import { createPoseDescriptor } from './deps';
import type { Pose3 } from './pose3';
import type { Viewport3d } from './project';
import { boundsOfTestNode, createTestScene, type TestScene } from './testScene';

function viewport(): Viewport3d {
  return {
    camera: createCamera({ distance: 12, pitch: 0.4, yaw: 0.3, target: { x: 0, y: 0.5, z: 0 } }),
    width: 800,
    height: 600,
  };
}

function worldOf(scene: TestScene) {
  return { scene, viewport: viewport, bounds: boundsOfTestNode };
}

/** A projection that keeps nothing and records every change it is shown. */
function recorder(): { projection: GeometryProjection<Pose3>; seen: Map<string, PoseChange<Pose3>> } {
  const seen = new Map<string, PoseChange<Pose3>>();
  return {
    seen,
    projection: {
      transform(node, _m: Affine, change) {
        seen.set(node.id!, change);
        return null;
      },
    },
  };
}

/** Press, move by `delta` screen px, release: the kit's move action, driven the way the dispatcher drives it. */
function drag(deps: Record<string, unknown>, delta: { x: number; y: number }): void {
  const invoker = moveAction.invoker;
  if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const start = { x: 400, y: 300 };
  const current = { x: start.x + delta.x, y: start.y + delta.y };
  const base = {
    world: start,
    screen: start,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps,
  };
  const d = { start, current, delta };
  const handle = invoker.start(base as unknown as InvocationCtx, undefined);
  handle.onMove!({ ...base, world: current, drag: d } as unknown as InvocationCtx);
  handle.onEnd!({ ...base, world: current, drag: d } as unknown as InvocationCtx, 'commit');
}

describe('geometryProjection in a 3D host', () => {
  it('reads a nudge as the 3D pose change it committed', () => {
    const scene = createTestScene();
    const id = [...scene.renderOrder()][0]!;
    const before = scene.get(id)!.pose;
    const poseDescriptor = createPoseDescriptor(worldOf(scene));
    const { projection, seen } = recorder();

    moveNodesOps(scene as never, [id], { dx: 12, dy: 0 }, { poseDescriptor, geometryProjection: projection } as never);

    const change = seen.get(id)!;
    expect(change.from).toBe(before);
    expect(change.to).toEqual(poseDescriptor.forNode!(scene.get(id)!).translate!(before, 12, 0));
    expect(change.to.position.x).not.toBeCloseTo(before.position.x, 3);
  });

  it('reads a drag as the 3D pose change it committed', () => {
    const scene = createTestScene();
    const id = [...scene.renderOrder()][0]! as NodeId;
    const before = scene.get(id)!.pose;
    const poseDescriptor = createPoseDescriptor(worldOf(scene));
    const { projection, seen } = recorder();

    drag({
      selection: { get: () => [id], set: () => {} },
      scene,
      poseDescriptor,
      geometryProjection: projection,
    }, { x: 40, y: 10 });

    const change = seen.get(id)!;
    expect(change.from).toBe(before);
    expect(change.to).toEqual(scene.get(id)!.pose);
    expect(change.to.position.y).toBe(before.position.y);
  });
});
