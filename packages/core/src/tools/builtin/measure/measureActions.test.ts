import { describe, it, expect } from 'vitest';
import type { Action, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { evaluateEnabled } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { RectPose, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { lastTransform } from 'interactions/actions/transform-again/memory';
import { createMeasureActions, MEASURE_ACTION_IDS } from './measureActions';
import { createMeasurementStore, measureBetween } from './measurement';

type AnyScene = Scene<unknown, string, unknown>;
type Pt = { x: number; y: number };

function setup(poses: RectPose[] = [{ x: 0, y: 0, width: 20, height: 10, rotation: 0 }]) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const ids = poses.map((pose) => scene.add({ kind: 'leaf', layer: 'main', data: {}, pose }) as string);
  let current: string[] = [...ids];
  const selection = {
    get: () => current,
    set: (next: string[]) => { current = [...next]; },
  } as unknown as SelectionApi;
  const store = createMeasurementStore();
  const actions = createMeasureActions(store);
  const action = (id: string): Action => actions.find((a) => a.id === id)!;
  const deps: Record<string, unknown> = { scene: scene as unknown as AnyScene, selection };
  const pose = (id: string) => scene.get(id as never)!.pose as RectPose;

  const ctx = (world: Pt, from: Pt, shift = false): InvocationCtx => ({
    world,
    screen: world,
    modifiers: { alt: false, ctrl: false, meta: false, shift },
    deps: deps as never,
    drag: { start: from, current: world, delta: { x: world.x - from.x, y: world.y - from.y } },
  });
  /** Drag the measure action the way the dispatcher does: deps on `start`
   *  only. Returns the handle so a test can stop before release. */
  const measure = (from: Pt, to: Pt, opts: { shift?: boolean; release?: 'commit' | 'cancel' | null; params?: () => Record<string, unknown> } = {}) => {
    const handle = (action(MEASURE_ACTION_IDS.measure).invoker as OngoingInvoker)
      .start(ctx(from, from), opts.params ? { params: opts.params } : undefined);
    const moved = { ...ctx(to, from, opts.shift), deps: {} as never };
    handle.onMove?.(moved);
    if (opts.release !== null) handle.onEnd?.(moved, opts.release ?? 'commit');
    return handle;
  };
  const enabled = (id: string) => evaluateEnabled(action(id), deps as never).enabled;
  const run = (id: string) => (action(id).invoker as ImmediateInvoker).run(deps as never);
  return { scene, ids, selection, store, deps, pose, measure, enabled, run };
}

describe('measureBetween', () => {
  it('reads the offset, its length, and its angle', () => {
    const m = measureBetween({ x: 1, y: 2 }, { x: 4, y: 6 });
    expect(m).toMatchObject({ dx: 3, dy: 4, distance: 5 });
    expect(m.angle).toBeCloseTo(-Math.atan2(4, 3), 12);
  });

  it('reads a line rising up and to the right as a positive angle, like a protractor', () => {
    expect(measureBetween({ x: 0, y: 0 }, { x: 10, y: -10 }).angle).toBeCloseTo(Math.PI / 4, 12);
    expect(measureBetween({ x: 0, y: 0 }, { x: -10, y: 0 }).angle).toBeCloseTo(Math.PI, 12);
  });

  it('reads a zero angle for a zero-length measurement', () => {
    expect(measureBetween({ x: 3, y: 3 }, { x: 3, y: 3 }).angle).toBe(0);
  });
});

describe('measure drag', () => {
  it('publishes the live measurement while dragging, and keeps it after release', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 }, { release: null });
    expect(rig.store.get()).toMatchObject({ dx: 30, dy: 40, distance: 50 });
    rig.measure({ x: 10, y: 10 }, { x: 20, y: 10 });
    expect(rig.store.get()).toMatchObject({ start: { x: 10, y: 10 }, end: { x: 20, y: 10 }, distance: 10 });
  });

  it('snaps both ends through the snap dep', () => {
    const rig = setup();
    rig.deps['snap'] = { point: (p: Pt) => ({ x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 }) };
    rig.measure({ x: 2, y: 3 }, { x: 28, y: 41 });
    expect(rig.store.get()).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 30, y: 40 } });
  });

  it('holds the angle to 15° steps with Shift', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 100, y: 5 }, { shift: true });
    expect(rig.store.get()!.angle).toBeCloseTo(0, 12);
    expect(rig.store.get()!.distance).toBeCloseTo(Math.hypot(100, 5), 9);
  });

  it('holds the angle to the binding\'s angleStep with Shift', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 100, y: 70 }, { shift: true, params: () => ({ angleStep: Math.PI / 4 }) });
    expect(rig.store.get()!.angle).toBeCloseTo(-Math.PI / 4, 12);
  });

  it('drops the measurement when the drag is canceled', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 }, { release: 'cancel' });
    expect(rig.store.get()).toBeNull();
  });

  it('drops a zero-length measurement on release', () => {
    const rig = setup();
    rig.measure({ x: 5, y: 5 }, { x: 5, y: 5 });
    expect(rig.store.get()).toBeNull();
  });
});

describe('transform by the measurement', () => {
  it('declines to move or rotate with no measurement, or with nothing selected', () => {
    const rig = setup();
    expect(rig.enabled(MEASURE_ACTION_IDS.moveBy)).toBe(false);
    expect(rig.enabled(MEASURE_ACTION_IDS.rotateBy)).toBe(false);
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(rig.enabled(MEASURE_ACTION_IDS.moveBy)).toBe(true);
    rig.selection.set([]);
    expect(rig.enabled(MEASURE_ACTION_IDS.moveBy)).toBe(false);
  });

  it('moves the selection by exactly the measured offset, as one undo step', () => {
    const rig = setup();
    rig.measure({ x: 3, y: 4 }, { x: 33.5, y: -6.25 });
    rig.run(MEASURE_ACTION_IDS.moveBy);
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 30.5, y: -10.25 });
    expect(lastTransform(rig.scene)).toEqual({ kind: 'translate', dx: 30.5, dy: -10.25 });
    rig.scene.undo();
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 0, y: 0 });
  });

  it('turns the selection counterclockwise on screen for a rising measurement', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 10, y: -10 });
    rig.run(MEASURE_ACTION_IDS.rotateBy);
    // The canvas's rotation is clockwise-positive, so counterclockwise is negative.
    expect(rig.pose(rig.ids[0]).rotation).toBeCloseTo(-Math.PI / 4, 12);
    expect(lastTransform(rig.scene)).toMatchObject({ kind: 'rotate', angle: -Math.PI / 4 });
  });

  it('rotates the selection by exactly the measured angle, as one undo step', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 10, y: 10 });
    rig.run(MEASURE_ACTION_IDS.rotateBy);
    expect(rig.pose(rig.ids[0]).rotation).toBeCloseTo(Math.PI / 4, 12);
    expect(lastTransform(rig.scene)).toMatchObject({ kind: 'rotate', pivot: 'union' });
    rig.scene.undo();
    expect(rig.pose(rig.ids[0]).rotation ?? 0).toBeCloseTo(0, 12);
  });

  it('keeps the measurement after transforming by it, so it can be applied again', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 5, y: 0 });
    rig.run(MEASURE_ACTION_IDS.moveBy);
    rig.run(MEASURE_ACTION_IDS.moveBy);
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 10, y: 0 });
  });

  it('clears the measurement, and declines to clear when there is none', () => {
    const rig = setup();
    expect(rig.enabled(MEASURE_ACTION_IDS.clear)).toBe(false);
    rig.measure({ x: 0, y: 0 }, { x: 5, y: 0 });
    rig.run(MEASURE_ACTION_IDS.clear);
    expect(rig.store.get()).toBeNull();
  });
});
