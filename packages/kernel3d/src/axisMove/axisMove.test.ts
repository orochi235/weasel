import { describe, expect, it } from 'vitest';
import {
  IDENTITY_POSE_COMPOSITION, createScene, type InvocationCtx, type NodeId, type OngoingInvoker,
} from '@weasel-js/core';
import { add, scale, type Vec3 } from '@weasel-js/geom/3d';
import { createCamera } from '../camera';
import { createPoseDescriptor, createSnap } from '../deps';
import { pose3, type Pose3 } from '../pose3';
import { projectPoint, type Viewport3d } from '../project';
import { alignPlaneSource, groundGridSource } from '../snap/sources';
import type { Scene3d, World3d } from '../world';
import { AXIS_DIRECTIONS, type WorldAxis } from './handles';
import { axisOfHit, createAxisMove } from './action';

type W = World3d<object, 'solids'>;
const KEYS = { alt: false, ctrl: false, meta: false, shift: false };
const Z_UP: Vec3 = { x: 0, y: 0, z: 1 };

function rig(poses: readonly Pose3[], up?: Vec3) {
  const camera = createCamera({ distance: 12, pitch: 0.45, yaw: 0.6, target: { x: 0, y: 0, z: 0 } });
  const vp: Viewport3d = { camera, width: 800, height: 600 };
  const scene: Scene3d<object, 'solids'> = createScene<object, 'solids', Pose3>({
    composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'solids' }],
    initial: poses.map((pose) => ({ kind: 'mark' as const, layer: 'solids' as const, pose, data: {} })),
  });
  const world: W = { scene, viewport: () => vp, ...(up ? { up } : {}) };
  const ids = [...scene.renderOrder()] as NodeId[];
  let selected: NodeId[] = [ids[0]!];
  const selection = { get: () => selected, set: (next: NodeId[]) => { selected = next; } };
  const move = createAxisMove(world, { selection });
  return { world, ids, move, selection, vp: { ...vp, ...(up ? { up } : {}) } };
}

type Rig = ReturnType<typeof rig>;

/** Press the middle of `axis`'s shaft and drag so the point under it goes `by` world units along the axis. */
function dragAlong(r: Rig, axis: WorldAxis, by: number, deps: Record<string, unknown> = {}): void {
  const handle = r.move.handles(r.vp).find((h) => h.axis === axis)!;
  const press = { x: (handle.from.x + handle.to.x) / 2, y: (handle.from.y + handle.to.y) / 2 };
  const hit = r.move.handleAt(press);
  expect(axisOfHit(hit)).toBe(axis);
  const pose = r.world.scene.get(r.ids[0]!)!.pose;
  const shift = scale(AXIS_DIRECTIONS[axis], by);
  const a = projectPoint(pose.position, r.vp)!;
  const b = projectPoint(add(pose.position, shift), r.vp)!;
  const to = { x: press.x + b.x - a.x, y: press.y + b.y - a.y };
  const all = {
    selection: r.selection, scene: r.world.scene, poseDescriptor: createPoseDescriptor(r.world), ...deps,
  };
  const ctx = (p: { x: number; y: number }) => ({
    world: p, screen: p, modifiers: KEYS, deps: all,
    drag: { start: press, current: p, delta: { x: p.x - press.x, y: p.y - press.y }, affordance: hit ?? undefined },
  }) as unknown as InvocationCtx;
  const running = (r.move.action.invoker as OngoingInvoker).start(ctx(press), undefined);
  running.onMove!(ctx(to));
  running.onEnd!(ctx(to), 'commit');
}

const positionOf = (r: Rig) => r.world.scene.get(r.ids[0]!)!.pose.position;

describe('axis handles', () => {
  it('lays out an arrow per axis, the up axis standing upright on screen', () => {
    for (const up of [undefined, Z_UP]) {
      const r = rig([pose3({ x: 0, y: 0, z: 0 })], up);
      const handles = r.move.handles(r.vp);
      expect(handles.map((h) => h.axis)).toEqual(['x', 'y', 'z']);
      const upright = handles.find((h) => h.axis === (up ? 'z' : 'y'))!;
      expect(upright.head[0].y).toBeLessThan(upright.from.y - 40);
      expect(Math.abs(upright.head[0].x - upright.from.x)).toBeLessThan(1e-6);
    }
  });

  it('claims a press on a handle exclusively, and nothing off them', () => {
    const r = rig([pose3({ x: 0, y: 0, z: 0 })]);
    const tip = r.move.handles(r.vp).find((h) => h.axis === 'x')!.head[0];
    expect(r.move.handleAt(tip)).toMatchObject({ kind: 'move3d.axis:x', strength: 'exclusive', targetIds: [r.ids[0]] });
    expect(r.move.handleAt({ x: tip.x + 200, y: tip.y + 200 })).toBeNull();
  });

  it('has none with nothing selected', () => {
    const r = rig([pose3({ x: 0, y: 0, z: 0 })]);
    r.selection.set([]);
    expect(r.move.handles(r.vp)).toEqual([]);
    expect(r.move.handleAt({ x: 400, y: 300 })).toBeNull();
  });
});

describe('the axis move', () => {
  it('drags a node up along each world axis and nothing else moves, as one undo step', () => {
    for (const up of [undefined, Z_UP]) {
      for (const axis of ['x', 'y', 'z'] as const) {
        const r = rig([pose3({ x: 0.25, y: 0.5, z: 0.25 })], up);
        const before = positionOf(r);
        dragAlong(r, axis, 1.3);
        const after = positionOf(r);
        expect(after[axis]).toBeCloseTo(before[axis] + 1.3, 6);
        for (const other of (['x', 'y', 'z'] as const).filter((a) => a !== axis)) expect(after[other]).toBe(before[other]);
        r.world.scene.history.undo();
        expect(positionOf(r)).toEqual(before);
      }
    }
  });

  it('lines a box up with a plane it passes going up, storing the plane exactly', () => {
    // The second box's top is at z = 2; the first's top starts at 1.
    const r = rig([pose3({ x: 0, y: 0, z: 0.5 }), pose3({ x: 3, y: 0, z: 1 }, { x: 1, y: 1, z: 2 })], Z_UP);
    dragAlong(r, 'z', 0.98, { snap: createSnap(r.world, { sources: [alignPlaneSource(r.world)] }) });
    expect(positionOf(r)).toEqual({ x: 0, y: 0, z: 1.5 });
  });

  it('snaps along the ground to the grid, storing the line exactly', () => {
    const r = rig([pose3({ x: 0.25, y: 0.5, z: 0.25 })]);
    dragAlong(r, 'x', 0.71, { snap: createSnap(r.world, { sources: [groundGridSource({ world: r.world, step: 0.5 })] }) });
    expect(positionOf(r)).toEqual({ x: 1, y: 0.5, z: 0.25 });
  });

  it('moves the whole selection along the axis together', () => {
    const r = rig([pose3({ x: 0, y: 0.5, z: 0 }), pose3({ x: 2, y: 1.5, z: -1 })]);
    r.selection.set([...r.ids]);
    dragAlong(r, 'y', 0.8);
    const second = r.world.scene.get(r.ids[1]!)!.pose.position;
    expect(positionOf(r).y).toBeCloseTo(1.3, 6);
    expect(second.y).toBeCloseTo(2.3, 6);
    expect(second.x).toBe(2);
    expect(second.z).toBe(-1);
  });

  it('declines a drag that did not start on a handle', () => {
    const r = rig([pose3({ x: 0, y: 0, z: 0 })]);
    const ctx = {
      world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: KEYS, deps: {},
      drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 } },
    } as unknown as InvocationCtx;
    expect((r.move.action.invoker as OngoingInvoker).start(ctx, undefined)).toEqual({});
  });
});
