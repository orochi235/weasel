import { describe, it, expect } from 'vitest';
import type { Action, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { ActionDisabledReason, evaluateEnabled } from '@weasel-js/routing';
import { createScene, sceneFromJSON } from 'core/scene/scene';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { isAnnotationLayer, isAnnotationNode } from 'core/scene/annotation';
import { lastTransform } from 'interactions/actions/transform-again/memory';
import { MEASURE_ACTION_IDS } from './actionIds';
import { measureBetween, measurementOf, measureEndsOf } from './measurement';
import { createMeasurements, currentMeasureId, measureIds } from './measurements';
import { measureCommands } from './measureCommands';
import { measureCreateAction, measureDragAction, measurePickAtAction } from './measureGestures';
import { measureEndSource, type MeasureHit } from './measureHit';
import type { SnapCollect } from 'domains/snap/types';
import { MEASURE_AFFORDANCE_KIND } from './measureLayer';
import { gridSource, sessionDep } from 'domains/snap/testing/sessionDep';

type AnyScene = Scene<unknown, string, unknown>;
type Pt = { x: number; y: number };

/** The measurement ends `measureEndSource` offers a pointer at `at`, `reach` world units out. */
function endsNear(scene: AnyScene, at: Pt, reach: number, reachPx?: number): Pt[] {
  const source = measureEndSource(reachPx === undefined ? {} : { reachPx });
  const q: SnapCollect = {
    gesture: 'point', probes: [{ id: 'pointer', at, role: 'pointer' }], delta0: { x: 0, y: 0 }, exclude: [],
    reachWorld: (px) => px, reachPx: source.reachPx ?? reach, scene,
  };
  return [...source.collect(q)].map((c) => c.locus.at);
}

function setup() {
  const scene = createScene<object, 'main' | 'notes', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'notes', annotation: true }],
  });
  const box = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 20, height: 10, rotation: 0 } }) as string;
  let current: string[] = [box];
  const selection = {
    get: () => current,
    set: (next: string[]) => { current = [...next]; },
  } as unknown as SelectionApi;
  const ms = createMeasurements({ layer: 'notes' });
  const actions: Action[] = [
    ...measureCommands(ms), measureCreateAction(ms), measurePickAtAction(ms), measureDragAction(ms),
  ];
  const action = (id: string): Action => actions.find((a) => a.id === id)!;
  const deps: Record<string, unknown> = { scene: scene as unknown as AnyScene, selection };
  const pose = (id: string) => scene.get(id as never)!.pose as RectPose;

  const ctx = (world: Pt, from: Pt, extra: Partial<InvocationCtx> = {}): InvocationCtx => ({
    world,
    screen: world,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: deps as never,
    drag: { start: from, current: world, delta: { x: world.x - from.x, y: world.y - from.y } },
    ...extra,
  });
  /** Drag an ongoing action the way the dispatcher does: deps on `start` only. */
  const drag = (
    id: string, from: Pt, to: Pt,
    opts: { shift?: boolean; release?: 'commit' | 'cancel'; params?: () => Record<string, unknown>; affordance?: unknown } = {},
  ) => {
    const startCtx = ctx(from, from);
    if (opts.affordance) startCtx.drag = { ...startCtx.drag!, affordance: opts.affordance } as never;
    const handle = (action(id).invoker as OngoingInvoker)
      .start(startCtx, opts.params ? { params: opts.params } : undefined);
    const moved = {
      ...ctx(to, from),
      modifiers: { alt: false, ctrl: false, meta: false, shift: opts.shift ?? false },
      deps: {} as never,
    };
    handle.onMove?.(moved);
    handle.onEnd?.(moved, opts.release ?? 'commit');
    return handle;
  };
  const measure = (from: Pt, to: Pt, opts: Parameters<typeof drag>[3] = {}) => drag(MEASURE_ACTION_IDS.measure, from, to, opts);
  const enabled = (id: string) => evaluateEnabled(action(id), deps as never);
  const run = (id: string, params?: Record<string, unknown>) =>
    (action(id).invoker as ImmediateInvoker).run(deps as never, params);
  const ids = () => measureIds(scene as unknown as AnyScene, ms);
  const ends = (id: NodeId) => measureEndsOf(scene.get(id as never));
  return { scene, box, selection, ms, deps, pose, measure, drag, enabled, run, ids, ends };
}

const onHit = (hit: MeasureHit) => ({ kind: MEASURE_AFFORDANCE_KIND, payload: hit });

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

describe('measuring', () => {
  it('adds each drag as a measurement node on the annotation layer, and picks it', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 });
    rig.measure({ x: 100, y: 0 }, { x: 100, y: 50 });
    const [a, b] = rig.ids();
    expect(rig.ids()).toHaveLength(2);
    expect(isAnnotationNode(rig.scene, a!)).toBe(true);
    expect(measurementOf(rig.scene.get(a!))).toMatchObject({ dx: 30, dy: 40, distance: 50 });
    expect(rig.ms.picked.get()).toBe(b);
  });

  it('shows the drag in the draft while it runs, and clears it on release', () => {
    const rig = setup();
    const seen: unknown[] = [];
    const off = rig.ms.draft.subscribe(() => seen.push(rig.ms.draft.get()));
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 });
    off();
    expect(seen).toContainEqual(expect.objectContaining({ dx: 30, dy: 40 }));
    expect(rig.ms.draft.get()).toBeNull();
  });

  it('snaps both ends through the snap dep', () => {
    const rig = setup();
    rig.deps['snap'] = sessionDep(rig.scene as unknown as AnyScene, [gridSource(10)]);
    rig.measure({ x: 2, y: 3 }, { x: 28, y: 41 });
    expect(rig.ends(rig.ids()[0]!)).toEqual({ start: { x: 0, y: 0 }, end: { x: 30, y: 40 } });
  });

  it("holds the angle to the binding's angleStep with Shift, 15° by default", () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 100, y: 5 }, { shift: true });
    rig.measure({ x: 0, y: 0 }, { x: 100, y: 70 }, { shift: true, params: () => ({ angleStep: Math.PI / 4 }) });
    const [flat, steep] = rig.ids().map((id) => measurementOf(rig.scene.get(id as never))!);
    expect(flat!.angle).toBeCloseTo(0, 12);
    expect(steep!.angle).toBeCloseTo(-Math.PI / 4, 12);
  });

  it('adds nothing for a canceled or zero-length drag', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 }, { release: 'cancel' });
    rig.measure({ x: 5, y: 5 }, { x: 5, y: 5 });
    expect(rig.ids()).toEqual([]);
    expect(rig.ms.draft.get()).toBeNull();
  });

  it('undoes an added measurement in one step', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 });
    rig.scene.undo();
    expect(rig.ids()).toEqual([]);
  });
});

describe('picking and the current measurement', () => {
  it('picks the measurement under a click, and drops the pick on empty canvas', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 100, y: 0 });
    rig.measure({ x: 0, y: 50 }, { x: 100, y: 50 });
    const [a, b] = rig.ids();
    rig.run(MEASURE_ACTION_IDS.pickAt, { pressX: 50, pressY: 2 });
    expect(rig.ms.picked.get()).toBe(a);
    rig.run(MEASURE_ACTION_IDS.pickAt, { pressX: 50, pressY: 49 });
    expect(rig.ms.picked.get()).toBe(b);
    rig.run(MEASURE_ACTION_IDS.pickAt, { pressX: 50, pressY: 25 });
    expect(rig.ms.picked.get()).toBeNull();
  });

  it('passes over a hidden or locked measurement to the one under it', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 100, y: 0 });
    rig.measure({ x: 0, y: 2 }, { x: 100, y: 2 });
    const [a, b] = rig.ids();
    rig.scene.setHidden(b!, true);
    rig.run(MEASURE_ACTION_IDS.pickAt, { pressX: 50, pressY: 2 });
    expect(rig.ms.picked.get()).toBe(a);
    rig.scene.setHidden(b!, false);
    rig.scene.setLocked(b!, true);
    rig.ms.picked.set(null);
    rig.run(MEASURE_ACTION_IDS.pickAt, { pressX: 50, pressY: 2 });
    expect(rig.ms.picked.get()).toBe(a);
  });

  it('acts on the picked measurement, else the newest', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 10, y: 0 });
    rig.measure({ x: 0, y: 0 }, { x: 0, y: 20 });
    const [a, b] = rig.ids();
    rig.ms.picked.set(null);
    expect(currentMeasureId(rig.scene as unknown as AnyScene, rig.ms)).toBe(b);
    rig.ms.picked.set(a!);
    expect(currentMeasureId(rig.scene as unknown as AnyScene, rig.ms)).toBe(a);
  });

  it('leaves the content selection alone when a measurement is picked', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 100, y: 0 });
    rig.run(MEASURE_ACTION_IDS.pickAt, { pressX: 50, pressY: 1 });
    expect(rig.selection.get()).toEqual([rig.box]);
  });
});

describe('transform by the measurement', () => {
  it('moves the selection by the picked measurement, as one undo step', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 });
    rig.measure({ x: 0, y: 0 }, { x: 5, y: 0 });
    rig.ms.picked.set(rig.ids()[0]!);
    rig.run(MEASURE_ACTION_IDS.moveBy);
    expect(rig.pose(rig.box)).toMatchObject({ x: 30, y: 40 });
    expect(lastTransform(rig.scene)).toEqual({ kind: 'translate', dx: 30, dy: 40 });
    rig.scene.undo();
    expect(rig.pose(rig.box)).toMatchObject({ x: 0, y: 0 });
  });

  it('turns the selection the way the measured line goes', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 10, y: -10 });
    rig.run(MEASURE_ACTION_IDS.rotateBy);
    // The canvas's rotation is clockwise-positive, so counterclockwise is negative.
    expect(rig.pose(rig.box).rotation).toBeCloseTo(-Math.PI / 4, 12);
    expect(lastTransform(rig.scene)).toMatchObject({ kind: 'rotate', angle: -Math.PI / 4 });
    rig.scene.undo();
    expect(rig.pose(rig.box).rotation ?? 0).toBeCloseTo(0, 12);
  });

  it('says why it cannot run: nothing measured, or nothing selected', () => {
    const rig = setup();
    expect(rig.enabled(MEASURE_ACTION_IDS.moveBy)).toMatchObject({ enabled: false, reason: ActionDisabledReason.NotApplicable });
    rig.measure({ x: 0, y: 0 }, { x: 5, y: 0 });
    expect(rig.enabled(MEASURE_ACTION_IDS.moveBy).enabled).toBe(true);
    rig.selection.set([]);
    expect(rig.enabled(MEASURE_ACTION_IDS.rotateBy)).toMatchObject({ enabled: false, reason: ActionDisabledReason.SelectionRequired });
  });
});

describe('editing a measurement', () => {
  it("moves the picked measurement's end, snapped, as one undo step", () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 50, y: 0 });
    const [id] = rig.ids();
    rig.deps['snap'] = sessionDep(rig.scene as unknown as AnyScene, [gridSource(10)]);
    rig.drag(MEASURE_ACTION_IDS.drag, { x: 50, y: 0 }, { x: 61, y: 19 }, { affordance: onHit({ id: id!, part: 'end' }) });
    expect(rig.ends(id!)).toEqual({ start: { x: 0, y: 0 }, end: { x: 60, y: 20 } });
    expect(rig.pose(id!)).toEqual({ x: 0, y: 0, width: 60, height: 20 });
    rig.scene.undo();
    expect(rig.ends(id!)).toEqual({ start: { x: 0, y: 0 }, end: { x: 50, y: 0 } });
  });

  it('keeps the offset from a press beside the end rather than jumping the end to the pointer', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 50, y: 0 });
    const [id] = rig.ids();
    rig.deps['snap'] = sessionDep(rig.scene as unknown as AnyScene, []);
    rig.drag(MEASURE_ACTION_IDS.drag, { x: 53, y: 2 }, { x: 63, y: 9 }, { affordance: onHit({ id: id!, part: 'end' }) });
    expect(rig.ends(id!)).toEqual({ start: { x: 0, y: 0 }, end: { x: 60, y: 7 } });
  });

  it('carries the whole measurement when the drag starts on its line', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 50, y: 0 });
    const [id] = rig.ids();
    rig.drag(MEASURE_ACTION_IDS.drag, { x: 25, y: 0 }, { x: 35, y: 5 }, { affordance: onHit({ id: id!, part: 'line' }) });
    expect(rig.ends(id!)).toEqual({ start: { x: 10, y: 5 }, end: { x: 60, y: 5 } });
  });

  it('carries an unpicked measurement rather than stretching it', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 50, y: 0 });
    const [id] = rig.ids();
    rig.ms.picked.set(null);
    rig.drag(MEASURE_ACTION_IDS.drag, { x: 50, y: 0 }, { x: 60, y: 0 }, { affordance: onHit({ id: id!, part: 'end' }) });
    expect(rig.ends(id!)).toEqual({ start: { x: 10, y: 0 }, end: { x: 60, y: 0 } });
    expect(rig.ms.picked.get()).toBe(id);
  });

  it('deletes the current measurement and clears them all, each undoable', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 10, y: 0 });
    rig.measure({ x: 0, y: 0 }, { x: 20, y: 0 });
    rig.run(MEASURE_ACTION_IDS.delete);
    expect(rig.ids()).toHaveLength(1);
    rig.scene.undo();
    expect(rig.ids()).toHaveLength(2);
    rig.run(MEASURE_ACTION_IDS.clear);
    expect(rig.ids()).toEqual([]);
    rig.scene.undo();
    expect(rig.ids()).toHaveLength(2);
  });

  it('drops the pick on unpick, and declines with nothing picked', () => {
    const rig = setup();
    expect(rig.enabled(MEASURE_ACTION_IDS.unpick).enabled).toBe(false);
    rig.measure({ x: 0, y: 0 }, { x: 10, y: 0 });
    rig.run(MEASURE_ACTION_IDS.unpick);
    expect(rig.ms.picked.get()).toBeNull();
  });
});

describe('measurements in the document', () => {
  it('round-trips through the scene snapshot, annotation layer and all', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 });
    const json = rig.scene.toJSON();
    expect(json.systemLayers.find((l) => l.id === 'notes')).toMatchObject({ annotation: true });
    const back = sceneFromJSON(json);
    expect(isAnnotationLayer(back.layers.find((l) => l.id === 'notes'))).toBe(true);
    const [id] = measureIds(back as unknown as AnyScene, rig.ms);
    expect(measurementOf(back.get(id!))).toMatchObject({ dx: 30, dy: 40 });
  });

  it('offers its ends to other tools as snap targets', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(endsNear(rig.scene as unknown as AnyScene, { x: 32, y: 37 }, 5)).toEqual([{ x: 30, y: 40 }]);
    expect(endsNear(rig.scene as unknown as AnyScene, { x: 50, y: 50 }, 5)).toEqual([]);
  });

  it('takes its own reach over the canvas\'s', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(endsNear(rig.scene as unknown as AnyScene, { x: 40, y: 40 }, 5)).toEqual([]);
    expect(endsNear(rig.scene as unknown as AnyScene, { x: 40, y: 40 }, 5, 12)).toEqual([{ x: 30, y: 40 }]);
  });

  it('offers no snap target from a hidden measurement', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 });
    rig.scene.setHidden(rig.ids()[0]!, true);
    expect(endsNear(rig.scene as unknown as AnyScene, { x: 32, y: 37 }, 5)).toEqual([]);
  });

  it('tells a content node from an annotation', () => {
    const rig = setup();
    rig.measure({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(isAnnotationNode(rig.scene, rig.box)).toBe(false);
    expect(isAnnotationNode(rig.scene, rig.ids()[0]!)).toBe(true);
  });
});
