import { describe, expect, it } from 'vitest';
import {
  createScene, insertAction, placeAction,
  type ImmediateInvoker, type InvocationCtx, type NodeId, type OngoingInvoker, type SnapSource,
} from '@weasel-js/core';
import { add, intersectRayPlane, pointOnRay, type Vec3 } from '@weasel-js/geom/3d';
import { MAX_PITCH, createCamera } from '../camera';
import { createPoseDescriptor, createSnap, screenBoxOf } from '../deps';
import { createInsert, type Footprint } from '../insert';
import { aabbOfPose, pose3, type Pose3 } from '../pose3';
import { projectPoint, rayAt, type Viewport3d } from '../project';
import type { Scene3d, World3d } from '../world';
import { alignPlaneSource, boxSnapSource, groundGridSource } from './sources';

type Point = { x: number; y: number };
type W = World3d<object, 'solids'>;

const FREE = { suspend: false, constrain: false };
const UP: Vec3 = { x: 0, y: 1, z: 0 };

function viewport(camera = createCamera({ distance: 12, pitch: 0.4, yaw: 0.3, target: { x: 1, y: 0.5, z: 0 } })): Viewport3d {
  return { camera, width: 800, height: 600 };
}

function worldOf(poses: readonly Pose3[], vp: Viewport3d = viewport()): { world: W; ids: NodeId[] } {
  const scene: Scene3d<object, 'solids'> = createScene<object, 'solids', Pose3>({
    systemLayers: [{ id: 'solids' }],
    initial: poses.map((pose) => ({ kind: 'leaf' as const, layer: 'solids' as const, pose, data: {} })),
  });
  return { world: { scene, viewport: () => vp }, ids: [...scene.renderOrder()] };
}

/** Where a screen point lands on the plane `up · p = offset`. */
function cast(vp: Viewport3d, s: Point, offset: number): Vec3 {
  const ray = rayAt(vp, s)!;
  return pointOnRay(ray, intersectRayPlane(ray, UP, offset)!);
}

/** A move of `id` pressed on its screen box's center, and the pointer that
 *  asks for the world delta `d` — the delta `translate` makes of it. */
function moveOf(world: W, id: NodeId) {
  const vp = world.viewport();
  const box = screenBoxOf(world, id, vp)!;
  const press = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const height = world.scene.get(id)!.pose.position.y;
  const anchor = cast(vp, press, height);
  return {
    press,
    pointerFor(d: Vec3): Point {
      const s = projectPoint(add(anchor, d), vp)!;
      return { x: s.x, y: s.y };
    },
    landed(point: Point): Pose3 {
      const node = world.scene.get(id)!;
      return createPoseDescriptor(world).forNode!(node).translate!(node.pose, point.x - press.x, point.y - press.y);
    },
  };
}

describe('createSnap: a 3D move', () => {
  it('snaps a corner onto another box\'s corner, and translate lands it exactly', () => {
    const { world, ids } = worldOf([pose3({ x: 0, y: 0.5, z: 0 }), pose3({ x: 3, y: 0.5, z: 0 })]);
    const snap = createSnap(world, { sources: [boxSnapSource(world)] });
    const move = moveOf(world, ids[0]!);
    const pointer = move.pointerFor({ x: 2.02, y: 0, z: 0.015 });

    // The unsnapped corner is within 5px of the target corner.
    const vp = world.viewport();
    const raw = aabbOfPose(move.landed(pointer));
    const gap = (a: Vec3, b: Vec3) => {
      const [p, q] = [projectPoint(a, vp)!, projectPoint(b, vp)!];
      return Math.hypot(p.x - q.x, p.y - q.y);
    };
    expect(gap(raw.max, { x: 2.5, y: 1, z: 0.5 })).toBeLessThan(5);

    const out = snap.begin({ gesture: 'move', ids: [ids[0]!], press: move.press }).at(pointer, FREE);
    expect(out.held).toBe(true);
    const box = aabbOfPose(move.landed(out.point));
    expect(box.max.x).toBeCloseTo(2.5, 6);
    expect(box.max.z).toBeCloseTo(0.5, 6);
    expect(box.min.y).toBeCloseTo(0, 12);
    expect(out.marks).toContainEqual(expect.objectContaining({ kind: 'point', glyph: 'corner' }));
  });

  it('snaps min-x to another box\'s min-x plane and leaves depth free', () => {
    const { world, ids } = worldOf([pose3({ x: 0, y: 0.5, z: 0 }), pose3({ x: 0.04, y: 0.5, z: -5 })]);
    const snap = createSnap(world, { sources: [alignPlaneSource(world)] });
    const move = moveOf(world, ids[0]!);
    const pointer = move.pointerFor({ x: 0.01, y: 0, z: 0.7 });

    const out = snap.begin({ gesture: 'move', ids: [ids[0]!], press: move.press }).at(pointer, FREE);
    expect(out.held).toBe(true);
    const snapped = move.landed(out.point);
    const raw = move.landed(pointer);
    expect(aabbOfPose(snapped).min.x).toBeCloseTo(-0.46, 6);
    expect(snapped.position.z).toBeCloseTo(raw.position.z, 6);
    expect(snapped.position.y).toBe(0.5);
  });

  it('still snaps, with nothing NaN, looking straight down', () => {
    const vp = viewport(createCamera({ distance: 12, pitch: MAX_PITCH, target: { x: 1, y: 0.5, z: 0 } }));
    const { world, ids } = worldOf([pose3({ x: 0, y: 0.5, z: 0 }), pose3({ x: 3, y: 0.5, z: 0 })], vp);
    const snap = createSnap(world, { sources: [boxSnapSource(world), alignPlaneSource(world), groundGridSource({ step: 1 })] });
    const move = moveOf(world, ids[0]!);
    const out = snap.begin({ gesture: 'move', ids: [ids[0]!], press: move.press })
      .at(move.pointerFor({ x: 2.02, y: 0, z: 0.015 }), FREE);
    expect(Number.isFinite(out.point.x) && Number.isFinite(out.point.y)).toBe(true);
    expect(out.held).toBe(true);
    expect(aabbOfPose(move.landed(out.point)).max.x).toBeCloseTo(2.5, 6);
  });

  it('never picks a target behind the camera', () => {
    // An unlimited reach: only the projection can rule the target out.
    const { world, ids } = worldOf([pose3({ x: 0, y: 0.5, z: 0 })]);
    const at = (target: Vec3): SnapSource<Vec3> => ({
      id: 'probe', roles: ['geometry'], reachPx: Infinity,
      *collect(q) {
        for (const p of q.probes) if (p.id === 'center') yield { probe: p.id, locus: { at: target, dirs: [] } };
      },
    });
    const move = moveOf(world, ids[0]!);
    const run = (target: Vec3) =>
      createSnap(world, { sources: [at(target)] }).begin({ gesture: 'move', ids: [ids[0]!], press: move.press })
        .at(move.press, FREE);
    // The control: a target as far off in front of the camera is taken.
    expect(run({ x: 0.5, y: 0.5, z: -3 }).held).toBe(true);
    // The eye is near z = 11, looking toward -z.
    const behind = run({ x: 0, y: 0.5, z: 30 });
    expect(behind.held).toBe(false);
    expect(behind.point.x).toBeCloseTo(move.press.x, 9);
    expect(behind.point.y).toBeCloseTo(move.press.y, 9);
  });

  it('holds a Shift move to the ground axes, and Ctrl suspends the targets', () => {
    const { world, ids } = worldOf([pose3({ x: 0, y: 0.5, z: 0 }), pose3({ x: 3, y: 0.5, z: 0 })]);
    const snap = createSnap(world, { sources: [boxSnapSource(world)] });
    const move = moveOf(world, ids[0]!);
    const begin = () => snap.begin({ gesture: 'move', ids: [ids[0]!], press: move.press, constrain: 'axis' });

    const locked = move.landed(begin().at(move.pointerFor({ x: 1.2, y: 0, z: 0.3 }), { suspend: false, constrain: true }).point);
    expect(locked.position.x).toBeCloseTo(1.2, 6);
    expect(locked.position.z).toBeCloseTo(0, 6);

    const near = move.pointerFor({ x: 2.02, y: 0, z: 0.015 });
    const out = begin().at(near, { suspend: true, constrain: false });
    expect(out.held).toBe(false);
    expect(out.marks).toEqual([]);
    expect(move.landed(out.point).position.x).toBeCloseTo(2.02, 6);
  });

  it('draws no marks for planes level with the move, which height alone meets', () => {
    const { world, ids } = worldOf([pose3({ x: 0, y: 0.5, z: 0 }), pose3({ x: 0.04, y: 0.5, z: -5 })]);
    const snap = createSnap(world, { sources: [alignPlaneSource(world)] });
    const move = moveOf(world, ids[0]!);
    const out = snap.begin({ gesture: 'move', ids: [ids[0]!], press: move.press })
      .at(move.pointerFor({ x: 0.01, y: 0, z: 0.7 }), FREE);
    expect(out.marks.length).toBeGreaterThan(0);
    // Every mark lies in an x plane: a y plane's would run level, between different xs.
    for (const m of out.marks) {
      if (m.kind !== 'line') throw new Error(`unexpected ${m.kind} mark`);
      expect(m.from.x).toBeCloseTo(m.to.x, 9);
    }
  });

  it('lands a move exactly with the world upside down', () => {
    const vp = viewport();
    const { world, ids } = worldOf([pose3({ x: 0, y: 0.5, z: 0 }), pose3({ x: 3, y: 0.5, z: 0 })], vp);
    const flipped: W = { ...world, up: { x: 0, y: -1, z: 0 } };
    const snap = createSnap(flipped, { sources: [boxSnapSource(flipped)] });
    const move = moveOf(flipped, ids[0]!);
    const out = snap.begin({ gesture: 'move', ids: [ids[0]!], press: move.press })
      .at(move.pointerFor({ x: 2.02, y: 0, z: 0.015 }), FREE);
    expect(out.held).toBe(true);
    const box = aabbOfPose(move.landed(out.point));
    expect(box.max.x).toBeCloseTo(2.5, 6);
    expect(box.max.z).toBeCloseTo(0.5, 6);
    expect(box.min.y).toBeCloseTo(0, 12);
  });
});

describe('createSnap: a 3D insert', () => {
  it('mints a footprint whose corners are the ground grid points the drag snapped to', () => {
    const { world } = worldOf([]);
    const vp = world.viewport();
    let minted: Footprint | null = null;
    const deps = {
      insert: createInsert({ viewport: world.viewport, mint: (f) => ((minted = f), 'n' as NodeId) }),
      snap: createSnap(world, { sources: [groundGridSource({ step: 1 })] }),
    };
    const ctx = (p: Vec3): InvocationCtx => {
      const s = projectPoint(p, vp)!;
      return { world: s, screen: s, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps };
    };
    const handle = (insertAction.invoker as OngoingInvoker).start(ctx({ x: 1.3, y: 0, z: -0.8 }), undefined);
    const end = ctx({ x: 3.2, y: 0, z: 0.7 });
    handle.onMove!(end);
    handle.onEnd!(end, 'commit');
    const f = minted as Footprint | null;
    expect(f).not.toBeNull();
    expect(f!.center.x - f!.width / 2).toBeCloseTo(1, 6);
    expect(f!.center.x + f!.width / 2).toBeCloseTo(3, 6);
    expect(f!.center.z - f!.depth / 2).toBeCloseTo(-1, 6);
    expect(f!.center.z + f!.depth / 2).toBeCloseTo(1, 6);
  });

  it('grows an Alt-drag footprint from the press out to the end', () => {
    const { world } = worldOf([]);
    const vp = world.viewport();
    let minted: Footprint | null = null;
    const deps = {
      insert: createInsert({ viewport: world.viewport, mint: (f) => ((minted = f), 'n' as NodeId) }),
      snap: createSnap(world),
    };
    const ctx = (p: Vec3): InvocationCtx => {
      const s = projectPoint(p, vp)!;
      return { world: s, screen: s, modifiers: { alt: true, ctrl: false, meta: false, shift: false }, deps };
    };
    const handle = (insertAction.invoker as OngoingInvoker).start(ctx({ x: 1.3, y: 0, z: -0.8 }), undefined);
    const end = ctx({ x: 2.1, y: 0, z: 0.4 });
    handle.onMove!(end);
    handle.onEnd!(end, 'commit');
    const f = minted as Footprint | null;
    expect(f!.center.x).toBeCloseTo(1.3, 6);
    expect(f!.center.z).toBeCloseTo(-0.8, 6);
    expect(f!.center.x + f!.width / 2).toBeCloseTo(2.1, 6);
    expect(f!.center.z + f!.depth / 2).toBeCloseTo(0.4, 6);
  });

  it('centers a click-placed footprint on the ground grid point the click snapped to', () => {
    const { world } = worldOf([]);
    const vp = world.viewport();
    let minted: Footprint | null = null;
    const deps = {
      insert: createInsert({ viewport: world.viewport, mint: (f) => ((minted = f), 'n' as NodeId) }),
      snap: createSnap(world, { sources: [groundGridSource({ step: 1 })] }),
    };
    const click = projectPoint({ x: 1.3, y: 0, z: -0.8 }, vp)!;
    (placeAction.invoker as ImmediateInvoker).run(deps as never, {
      kind: 'rect', size: { width: 40, height: 30 }, worldX: click.x, worldY: click.y,
    });
    const f = minted as Footprint | null;
    expect(f).not.toBeNull();
    expect(f!.center.x).toBeCloseTo(1, 6);
    expect(f!.center.z).toBeCloseTo(-1, 6);
  });

  it('snaps an insert onto a box corner on the ground ahead of the grid', () => {
    const { world } = worldOf([pose3({ x: 0.3, y: 0.5, z: 0.3 })]);
    const vp = world.viewport();
    const snap = createSnap(world, { sources: [boxSnapSource(world), groundGridSource({ step: 1 })] });
    const press = projectPoint({ x: 0.81, y: 0, z: 0.79 }, vp)!;
    const ground = cast(vp, snap.begin({ gesture: 'point', press }).at(press, FREE).point, 0);
    expect(ground.x).toBeCloseTo(0.8, 6);
    expect(ground.z).toBeCloseTo(0.8, 6);
  });
});
