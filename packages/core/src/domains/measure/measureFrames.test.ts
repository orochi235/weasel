import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import type { UnitScope } from '@weasel-js/quantity';
import { createScene } from 'core/scene/scene';
import { asNodeId, type AddNodeSpec, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import { measureEndsOf, measureMagnification, measurementOf } from './measurement';
import { createMeasurements, measureIds } from './measurements';
import { measureCreateAction, measureDragAction } from './measureGestures';
import { MEASURE_AFFORDANCE_KIND } from './measureLayer';
import type { MeasureHit } from './measureHit';

type AnyScene = Scene<unknown, string, unknown>;
type Pt = { x: number; y: number };
type Spec = AddNodeSpec<object, 'main' | 'notes', RectPose>;

const IN = { system: { base: 'in', units: { in: 1 } } } satisfies UnitScope;
const DRAWER = asNodeId('drawer');
const SHELF = asNodeId('shelf');

/** A drawer drawn at 0.4×, its 100-unit box shown from 30 to 70, and beside it a shelf at 1×. */
function setup() {
  const spec = (id: string, pose: RectPose, units: UnitScope): Spec =>
    ({ id: asNodeId(id), kind: 'group', layer: 'main', pose, data: {}, units });
  const scene = createScene<object, 'main' | 'notes', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'notes', annotation: true }],
    initial: [
      spec('drawer', { x: 0, y: 0, width: 100, height: 100, transform: [0.4, 0, 0, 0.4] }, { ...IN, drawnAt: 0.4 }),
      spec('shelf', { x: 200, y: 0, width: 100, height: 100 }, IN),
    ],
  }) as unknown as AnyScene;
  const ms = createMeasurements({ layer: 'notes' });
  const deps = { scene, selection: { get: () => [], set: () => {} } };
  const ctx = (world: Pt, from: Pt, affordance?: unknown): InvocationCtx => ({
    world,
    screen: world,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: deps as never,
    drag: { start: from, current: world, delta: { x: world.x - from.x, y: world.y - from.y }, ...(affordance ? { affordance } : {}) } as never,
  });
  /** Drag an ongoing action the way the dispatcher does: deps on `start` only. */
  const drag = (invoker: OngoingInvoker, from: Pt, to: Pt, affordance?: unknown) => {
    const handle = invoker.start(ctx(from, from, affordance));
    const moved = { ...ctx(to, from), deps: {} as never };
    handle.onMove?.(moved);
    handle.onEnd?.(moved, 'commit');
  };
  const measure = (from: Pt, to: Pt) => drag(measureCreateAction(ms).invoker as OngoingInvoker, from, to);
  const move = (hit: MeasureHit, from: Pt, to: Pt) => {
    ms.picked.set(hit.id);
    drag(measureDragAction(ms).invoker as OngoingInvoker, from, to, { kind: MEASURE_AFFORDANCE_KIND, payload: hit });
  };
  const newest = () => measureIds(scene, ms).at(-1)!;
  const frames = (id: NodeId = newest()) => measureEndsOf(scene.get(id))?.frames;
  /** The newest measurement's distance in the units of the frame its ends landed in. */
  const length = () => {
    const m = measurementOf(scene.get(newest()))!;
    return m.distance / measureMagnification(scene, m.frames);
  };
  return { scene, ms, ctx, measure, move, newest, frames, length };
}

describe('a measurement records the frame each end lands in', () => {
  it('reads its true length inside a frame drawn at 0.4×', () => {
    const rig = setup();
    rig.measure({ x: 35, y: 40 }, { x: 65, y: 40 });
    expect(rig.frames()).toEqual({ start: DRAWER, end: DRAWER });
    expect(rig.length()).toBeCloseTo(75);
  });

  it('reads in world when its ends land in frames that disagree, or outside any', () => {
    const rig = setup();
    rig.measure({ x: 50, y: 40 }, { x: 250, y: 40 });
    expect(rig.frames()).toEqual({ start: DRAWER, end: SHELF });
    expect(rig.length()).toBeCloseTo(200);
    rig.measure({ x: 50, y: 40 }, { x: 50, y: 140 });
    expect(rig.frames()).toEqual({ start: DRAWER, end: null });
    expect(rig.length()).toBeCloseTo(100);
  });

  it('shows the frames in the draft while the drag runs', () => {
    const rig = setup();
    const from = { x: 35, y: 40 };
    const handle = (measureCreateAction(rig.ms).invoker as OngoingInvoker).start(rig.ctx(from, from));
    handle.onMove?.(rig.ctx({ x: 250, y: 40 }, from));
    expect(rig.ms.draft.get()?.frames).toEqual({ start: DRAWER, end: SHELF });
    handle.onEnd?.(rig.ctx({ x: 250, y: 40 }, from), 'cancel');
  });

  it('records the frame an end is dragged into, and those a carried measurement lands in', () => {
    const rig = setup();
    rig.measure({ x: 35, y: 40 }, { x: 65, y: 40 });
    const id = rig.newest();
    rig.move({ id, part: 'end' }, { x: 65, y: 40 }, { x: 250, y: 40 });
    expect(rig.frames(id)).toEqual({ start: DRAWER, end: SHELF });
    rig.move({ id, part: 'line' }, { x: 100, y: 40 }, { x: 300, y: 40 });
    expect(rig.frames(id)).toEqual({ start: SHELF, end: null });
  });
});
