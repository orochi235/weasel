import { describe, expect, it } from 'vitest';
import {
  IDENTITY_POSE_COMPOSITION, createScene, moveAction, moveNodes, moveNodesOps,
  type GeometryProjection, type InvocationCtx, type NodeId, type PoseChange,
} from '@weasel-js/core';
import type { Affine } from '@weasel-js/geom';
import { createCamera } from './camera';
import { add, intersectRayPlane, pointOnRay, sub, type Vec3 } from '@weasel-js/geom/3d';
import { createPoseDescriptor, createSnap, screenBoxOf } from './deps';
import { aabbOfPose, pose3, type Pose3 } from './pose3';
import { projectPoint, rayAt, type Viewport3d } from './project';
import { boxSnapSource } from './snap/sources';
import {
  boundsOfTestNode, createFramedTestScene, createTestScene, type TestScene,
} from './testScene';
import { POSE3_COMPOSITION } from './composePose3';

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

describe('a 3D move of several roots', () => {
  /** The first and third test solids: different heights, different places on screen. */
  function twoRoots() {
    const scene = createTestScene();
    const order = [...scene.renderOrder()];
    const ids = [order[0]!, order[2]!] as NodeId[];
    const before = ids.map((id) => scene.get(id)!.pose);
    const poseDescriptor = createPoseDescriptor(worldOf(scene));
    return { scene, ids, before, poseDescriptor };
  }

  function movedBy(after: Pose3, before: Pose3) {
    return {
      x: after.position.x - before.position.x,
      y: after.position.y - before.position.y,
      z: after.position.z - before.position.z,
    };
  }

  it('would move each root a different distance if each read the screen delta alone', () => {
    const { scene, ids, before, poseDescriptor } = twoRoots();
    const [a, b] = ids.map((id, i) => poseDescriptor.forNode!(scene.get(id)!).translate!(before[i]!, 40, 10));
    expect(movedBy(a!, before[0]!).x).not.toBeCloseTo(movedBy(b!, before[1]!).x, 3);
  });

  it('drags every root by the world delta it lands the first one', () => {
    const { scene, ids, before, poseDescriptor } = twoRoots();
    drag({ selection: { get: () => ids, set: () => {} }, scene, poseDescriptor }, { x: 40, y: 10 });

    const first = movedBy(scene.get(ids[0]!)!.pose, before[0]!);
    const second = movedBy(scene.get(ids[1]!)!.pose, before[1]!);
    expect(first.x).not.toBeCloseTo(0, 3);
    expect(second.x).toBeCloseTo(first.x, 12);
    expect(second.z).toBeCloseTo(first.z, 12);
    expect(second.y).toBe(0);
    expect(first).toEqual(movedBy(poseDescriptor.forNode!(scene.get(ids[0]!)!).translate!(before[0]!, 40, 10), before[0]!));
  });

  it('nudges every root by the world delta it moves the first one', () => {
    const { scene, ids, before, poseDescriptor } = twoRoots();
    moveNodes({ scene, poseDescriptor } as never, ids, { dx: 12, dy: -4 }, 'Nudge');

    const first = movedBy(scene.get(ids[0]!)!.pose, before[0]!);
    const second = movedBy(scene.get(ids[1]!)!.pose, before[1]!);
    expect(first.x).not.toBeCloseTo(0, 3);
    expect(second.x).toBeCloseTo(first.x, 12);
    expect(second.z).toBeCloseTo(first.z, 12);
  });

  it('lands a root other than the first exactly on what it snapped to', () => {
    // The first root sits at another height and place on screen than the
    // second, whose far corner is dragged to just short of the target's near one.
    const scene = createScene<object, 'solids', Pose3>({
      composition: IDENTITY_POSE_COMPOSITION,
      systemLayers: [{ id: 'solids' }],
      initial: [
        pose3({ x: 0, y: 0.5, z: 0 }),
        pose3({ x: 3, y: 1, z: 0 }),
        pose3({ x: 5.02, y: 2, z: 1.01 }),
      ].map((pose) => ({ kind: 'mark' as const, layer: 'solids' as const, pose, data: {} })),
    });
    const [a, b] = [...scene.renderOrder()] as NodeId[];
    const world = { scene, viewport };
    const vp = viewport();
    const box = screenBoxOf(world, a!, vp)!;
    const anchor = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const ray = rayAt(vp, anchor)!;
    const onA = pointOnRay(ray, intersectRayPlane(ray, { x: 0, y: 1, z: 0 }, 0.5)!);
    const wanted: Vec3 = { x: 1, y: 0, z: 0 };
    const to = projectPoint(add(onA, wanted), vp)!;

    drag({
      selection: { get: () => [a!, b!], set: () => {} },
      scene,
      poseDescriptor: createPoseDescriptor(world),
      snap: createSnap(world, { sources: [boxSnapSource(world)] }),
    }, { x: to.x - anchor.x, y: to.y - anchor.y });

    const max = aabbOfPose(scene.get(b!)!.pose).max;
    expect(max.x).toBeCloseTo(4.52, 9);
    expect(max.z).toBeCloseTo(0.51, 9);
    expect(max.y).toBe(1.5);
  });
});

describe('a 3D move through a camera that casts no ray', () => {
  it('leaves the solid where it is rather than moving it through the camera of an earlier gesture', () => {
    const scene = createTestScene();
    const id = [...scene.renderOrder()][0]! as NodeId;
    const before = scene.get(id)!.pose;
    let vp = viewport();
    const poseDescriptor = createPoseDescriptor({ scene, viewport: () => vp, bounds: boundsOfTestNode });
    const deps = { selection: { get: () => [id], set: () => {} }, scene, poseDescriptor };
    drag(deps, { x: 40, y: 10 });
    const after = scene.get(id)!.pose;
    expect(after).not.toEqual(before);
    // The pane collapses: no ray from it, for this gesture or any later one.
    vp = { ...viewport(), width: 0, height: 0 };
    drag(deps, { x: 40, y: 10 });
    expect(scene.get(id)!.pose).toEqual(after);
    moveNodes({ scene, poseDescriptor } as never, [id], { dx: 12, dy: -4 }, 'Nudge');
    expect(scene.get(id)!.pose).toEqual(after);
  });
});

describe('a 3D move whose camera stops casting rays mid-drag', () => {
  it('keeps moving through the last camera that did', () => {
    const scene = createTestScene();
    const id = [...scene.renderOrder()][0]! as NodeId;
    let vp = viewport();
    const poseDescriptor = createPoseDescriptor({ scene, viewport: () => vp, bounds: boundsOfTestNode });
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const start = { x: 400, y: 300 };
    const at = (dx: number) => ({
      world: { x: start.x + dx, y: start.y }, screen: start,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { selection: { get: () => [id], set: () => {} }, scene, poseDescriptor },
      drag: { start, current: { x: start.x + dx, y: start.y }, delta: { x: dx, y: 0 } },
    }) as unknown as InvocationCtx;
    const handle = invoker.start({ ...at(0), drag: undefined } as unknown as InvocationCtx, undefined);
    handle.onMove!(at(20));
    const expected = poseDescriptor.forNode!(scene.get(id)!).translate!(scene.get(id)!.pose, 40, 0);
    vp = { ...viewport(), width: 0, height: 0 };
    handle.onMove!(at(40));
    handle.onEnd!(at(40), 'commit');
    expect(scene.get(id)!.pose.position.x).toBeCloseTo(expected.position.x, 9);
    expect(scene.get(id)!.pose.position.z).toBeCloseTo(expected.position.z, 9);
  });
});

describe('a 3D move of several roots, one stored under a container', () => {
  function framedRoots() {
    const { scene, framed, frame } = createFramedTestScene();
    const lead = [...scene.renderOrder()][0]! as NodeId;
    const worldOfFramed = () => POSE3_COMPOSITION.compose(scene.get(frame)!.pose, scene.get(framed)!.pose);
    const before = { lead: scene.get(lead)!.pose, framed: worldOfFramed() };
    const poseDescriptor = createPoseDescriptor(worldOf(scene));
    const moved = () => ({
      lead: sub(scene.get(lead)!.pose.position, before.lead.position),
      framed: sub(worldOfFramed().position, before.framed.position),
    });
    return { scene, ids: [lead, framed as NodeId], poseDescriptor, moved };
  }

  it('drags the framed root by the world delta it lands the first one', () => {
    const { scene, ids, poseDescriptor, moved } = framedRoots();
    drag({ selection: { get: () => ids, set: () => {} }, scene, poseDescriptor }, { x: 40, y: 10 });
    const { lead, framed } = moved();
    expect(lead.x).not.toBeCloseTo(0, 3);
    expect(framed.x).toBeCloseTo(lead.x, 9);
    expect(framed.y).toBeCloseTo(0, 9);
    expect(framed.z).toBeCloseTo(lead.z, 9);
  });

  it('drags a framed root wholly behind the camera by the world delta it lands the first one', () => {
    const { scene, ids, moved } = framedRoots();
    // Close to the lead, between it and the framed root, looking at the lead.
    const lead = scene.get(ids[0]!)!.pose.position;
    const at = (yaw: number): Viewport3d => ({
      camera: createCamera({ distance: 3, pitch: 0.1, yaw, target: lead }), width: 800, height: 600,
    });
    const behindAt = (yaw: number) => screenBoxOf({ scene, viewport: () => at(yaw), bounds: boundsOfTestNode }, ids[1]!, at(yaw)) === null;
    const yaw = Array.from({ length: 64 }, (_, i) => (i * Math.PI) / 32).find(behindAt)!;
    const close = () => at(yaw);
    const world = { scene, viewport: close, bounds: boundsOfTestNode };
    expect(screenBoxOf(world, ids[1]!, close())).toBeNull();
    expect(screenBoxOf(world, ids[0]!, close())).not.toBeNull();
    drag({ selection: { get: () => ids, set: () => {} }, scene, poseDescriptor: createPoseDescriptor(world) }, { x: 40, y: 10 });
    const { lead: l, framed } = moved();
    expect(l.x + l.z).not.toBeCloseTo(0, 3);
    expect(framed.x).toBeCloseTo(l.x, 9);
    expect(framed.z).toBeCloseTo(l.z, 9);
  });

  it('nudges the framed root by the world delta it moves the first one', () => {
    const { scene, ids, poseDescriptor, moved } = framedRoots();
    moveNodes({ scene, poseDescriptor } as never, ids, { dx: 12, dy: -4 }, 'Nudge');
    const { lead, framed } = moved();
    expect(lead.x).not.toBeCloseTo(0, 3);
    expect(framed.x).toBeCloseTo(lead.x, 9);
    expect(framed.z).toBeCloseTo(lead.z, 9);
  });
});

