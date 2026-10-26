/** A rotate snapping through the `snap` dep's one-dimensional angle path. */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { createSnapOutcomeStore } from 'domains/snap/outcomeStore';
import { rotationSnapSource } from 'domains/snap/rotationSource';
import { sceneSession2d } from 'domains/snap/sceneSession2d';
import { drawnBoxes } from '../drawnBoxes';
import type { SnapDep } from '../snapDep';
import { rotateAction } from './action';

type Point = { x: number; y: number };
type AnyScene = Scene<unknown, string, unknown>;
type Pose = { x: number; y: number; width: number; height: number; rotation: number };

const KEYS = { alt: false, ctrl: false, meta: false, shift: false };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DEG = Math.PI / 180;
/** The subject's center, and the press radius from it in screen px. */
const PIVOT = { x: 50, y: 50 };
const RADIUS = 50;

function rig(opts: { rotation?: number; others?: readonly number[]; selected?: readonly number[]; snap?: boolean } = {}) {
  const scene = createScene<object, 'main', unknown>({ systemLayers: [{ id: 'main' }] }) as unknown as AnyScene;
  const id = scene.add({
    kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100, rotation: opts.rotation ?? 0 },
  }) as string;
  // More selected nodes on the same box, so the pivot stays put.
  const ids = [id, ...(opts.selected ?? []).map((r) => scene.add({
    kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100, rotation: r },
  }) as string)];
  for (const [i, r] of (opts.others ?? []).entries()) {
    scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 300 + i * 50, y: 0, width: 10, height: 10, rotation: r } });
  }
  const store = createSnapOutcomeStore();
  const snap: SnapDep = {
    begin: (req) => sceneSession2d({
      req, scene, boxes: drawnBoxes({ scene }), sources: [rotationSnapSource()], view: () => VIEW, reachPx: 8, store,
    }),
  };
  const deps = {
    scene, selection: { get: () => ids, set: () => {} } as unknown as SelectionApi,
    ...(opts.snap === false ? {} : { snap }),
  };
  const at = (p: Point, mods: Partial<typeof KEYS> = {}) => ({
    world: p, screen: p, modifiers: { ...KEYS, ...mods }, deps,
  }) as unknown as InvocationCtx;
  const press = (): OngoingHandle =>
    (rotateAction.invoker as OngoingInvoker).start(at({ x: PIVOT.x + RADIUS, y: PIVOT.y }), {});
  /** The pointer turned `deg` degrees about the pivot from the press. */
  const turnedTo = (deg: number, mods: Partial<typeof KEYS> = {}) =>
    at({ x: PIVOT.x + RADIUS * Math.cos(deg * DEG), y: PIVOT.y + RADIUS * Math.sin(deg * DEG) }, mods);
  /** Turn by `deg`, release, and read the committed rotation in degrees. */
  const turn = (deg: number, mods: Partial<typeof KEYS> = {}) => {
    const h = press();
    const ctx = turnedTo(deg, mods);
    h.onMove!(ctx);
    h.onEnd!(ctx, 'commit');
    return ((scene.get(asNodeId(id))!.pose as Pose).rotation) / DEG;
  };
  const rotationOf = (i: number) => (scene.get(asNodeId(ids[i]))!.pose as Pose).rotation / DEG;
  return { scene, store, press, turnedTo, turn, rotationOf };
}

describe('rotate snapping', () => {
  it('snaps 88° to 90°', () => {
    expect(rig().turn(88)).toBeCloseTo(90, 6);
  });

  it('leaves 80° alone: 8px at a 50px radius reaches about 9°', () => {
    expect(rig().turn(80)).toBeCloseTo(80, 6);
  });

  it('steps to 45° from 50° while Shift is held', () => {
    expect(rig().turn(50, { shift: true })).toBeCloseTo(45, 6);
  });

  it("snaps 31° to another node's 30°", () => {
    expect(rig({ others: [30 * DEG] }).turn(31)).toBeCloseTo(30, 6);
  });

  it('snaps the angle the node ends at, not the amount turned', () => {
    expect(rig({ rotation: 10 * DEG }).turn(22, { shift: true })).toBeCloseTo(30, 6);
  });

  it('steps the first node of a selection and turns the rest by as much', () => {
    const r = rig({ selected: [5 * DEG] });
    expect(r.turn(22, { shift: true })).toBeCloseTo(15, 6);
    expect(r.rotationOf(1)).toBeCloseTo(20, 6);
  });

  it('suspends while Ctrl is held', () => {
    expect(rig().turn(88, { ctrl: true })).toBeCloseTo(88, 6);
  });

  it('keeps the Shift step while Ctrl suspends the targets', () => {
    expect(rig({ others: [50 * DEG] }).turn(50, { shift: true, ctrl: true })).toBeCloseTo(45, 6);
  });

  it('compares angles round the circle: 359° lands on 360°', () => {
    expect(rig({ rotation: 300 * DEG }).turn(59)).toBeCloseTo(360, 6);
  });

  it("catches a node's angle a whole turn away", () => {
    expect(rig({ others: [(30 - 360) * DEG] }).turn(31)).toBeCloseTo(30, 6);
  });

  it('draws a mark while held and clears it on release', () => {
    const r = rig();
    const h = r.press();
    h.onMove!(r.turnedTo(88));
    expect(r.store.get()).not.toEqual([]);
    h.onMove!(r.turnedTo(60));
    expect(r.store.get()).toEqual([]);
    h.onEnd!(r.turnedTo(60), 'commit');
    expect(r.store.get()).toEqual([]);
  });

  it('steps with Shift on a host with no snap dep', () => {
    expect(rig({ snap: false }).turn(50, { shift: true })).toBeCloseTo(45, 6);
  });
});
