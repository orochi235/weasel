import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import type { InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { useAnimator } from '@weasel-js/animator/react';
import { createScene } from '../core/scene/scene';
import { effectivePose } from '../core/scene/effectivePose';
import { asNodeId, type NodeId, type RectPose } from '../core/scene/types';
import { createTransformOp } from '../core/ops/transform';
import { moveAction } from '../interactions/actions/move/action';
import { createReflowTransition } from './reflow';
import { bindPoseTransition, type PoseTransitionSeat } from './poseTransition';
import { createDepartures } from './departures';

const at = (x: number, y = 0): RectPose => ({ x, y, width: 10, height: 10 });
const A = asNodeId('a');

/** A scene holding `a`, a transition on a manual clock, and the seat bound to it. */
function setup(seat: Omit<PoseTransitionSeat<RectPose>, 'transition'> = {}) {
  const cbs: ((t: number) => void)[] = [];
  let clock = 0;
  const { result } = renderHook(() => useAnimator({
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
    now: () => clock,
  }));
  const frame = (t: number) => {
    clock = t;
    act(() => { for (const cb of cbs.splice(0)) cb(t); });
  };
  const scene = createScene<object, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: [{ id: A, kind: 'mark', layer: 'main', pose: at(0), data: {} }],
  });
  const transition = createReflowTransition(scene, result.current, { ms: 100, easing: linear });
  const departures = createDepartures<RectPose, unknown>();
  bindPoseTransition(scene, () => ({ transition, ...seat }), departures);
  const where = (id: NodeId = A) => effectivePose(scene, scene.get(id)!);
  const ghosts = () => departures.shown().map((d) => ({ id: d.removal.id, x: d.pose.x, alpha: d.alpha }));
  return { scene, transition, departures, frame, where, ghosts };
}

const batchAdapter = (scene: ReturnType<typeof setup>['scene']) => ({
  setPose: (id: string, p: RectPose) => scene.setPose(asNodeId(id), p),
  getPose: (id: string) => scene.get(asNodeId(id))!.pose,
});

describe('bindPoseTransition', () => {
  it('glides a node another writer shows only the data of', () => {
    const { scene, frame, where } = setup();
    scene.overrides.set(A, { data: (stored: object) => ({ ...stored, draft: true }) });
    act(() => { scene.setPose(A, at(100)); });
    expect(where().x).toBe(0);
    frame(0);
    frame(50);
    expect(where().x).toBeCloseTo(50);
  });

  it('leaves a node another writer poses to that writer', () => {
    const { scene, where } = setup();
    scene.overrides.set(A, { pose: at(300) });
    act(() => { scene.setPose(A, at(100)); });
    expect(where().x).toBe(300);
  });

  it("glides a bare setPose from the pose it left, and lets go once there", () => {
    const { scene, transition, frame, where } = setup();
    act(() => { scene.setPose(A, at(100)); });
    expect(scene.get(A)!.pose.x).toBe(100);
    expect(where().x).toBe(0);
    frame(0);
    frame(50);
    expect(where().x).toBeCloseTo(50);
    frame(100);
    expect(where().x).toBe(100);
    expect(transition.poseOf(A)).toBeUndefined();
    expect(scene.overrides.has(A)).toBe(false);
  });

  it('turns a glide in flight toward a second write, from where it is shown', () => {
    const { scene, frame, where } = setup();
    act(() => { scene.setPose(A, at(100)); });
    frame(0);
    frame(50);
    const shown = where().x;
    act(() => { scene.setPose(A, at(0, 80)); });
    expect(where().x).toBeCloseTo(shown);
    frame(500);
    expect(where()).toMatchObject({ x: 0, y: 80 });
  });

  it('glides an undo and a redo', () => {
    const { scene, frame, where } = setup();
    scene.setPose(A, at(100));
    frame(0);
    frame(1000);
    act(() => { scene.undo(); });
    expect(where().x).toBe(100);
    frame(1050);
    expect(where().x).toBeCloseTo(50);
    frame(1100);
    act(() => { scene.redo(); });
    expect(where().x).toBe(0);
  });

  it("snaps an action's commit by default, and glides it when the seat admits it", () => {
    const snapped = setup();
    act(() => { snapped.scene.applyBatch([createTransformOp<RectPose>({ id: A, from: at(0), to: at(60) })], 'Align', batchAdapter(snapped.scene)); });
    expect(snapped.where().x).toBe(60);

    const glided = setup({ glides: (w) => w.origin === 'ops' && w.label === 'Align' });
    act(() => { glided.scene.applyBatch([createTransformOp<RectPose>({ id: A, from: at(0), to: at(60) })], 'Align', batchAdapter(glided.scene)); });
    expect(glided.where().x).toBe(0);
  });

  it('leaves a node something else shows to it: a drag released where it is written stays put', () => {
    const { scene, transition, frame, where } = setup({ glides: () => true });
    const ctx = (x: number) => ({
      world: { x, y: 5 },
      screen: { x, y: 5 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { selection: { get: () => [A] }, scene },
      drag: { start: { x: 5, y: 5 }, current: { x, y: 5 }, delta: { x: x - 5, y: 0 } },
    }) as unknown as InvocationCtx;
    const h = (moveAction.invoker as OngoingInvoker).start(ctx(5), {}) as OngoingHandle;
    h.onMove!(ctx(45));
    act(() => { h.onEnd!(ctx(45), 'commit'); });
    expect(scene.get(A)!.pose.x).toBe(40);
    expect(where().x).toBe(40);
    expect(transition.poseOf(A)).toBeUndefined();
    frame(0);
    expect(where().x).toBe(40);
  });

  it('grows an added node in from where `enter` puts it, and shows one with no `enter` in place', () => {
    const grown = setup({ enter: (p) => ({ ...p, width: 0, height: 0 }) });
    let b!: NodeId;
    act(() => { b = grown.scene.add({ kind: 'mark', layer: 'main', pose: at(20), data: {} }); });
    expect(grown.where(b).width).toBe(0);
    grown.frame(0);
    grown.frame(100);
    expect(grown.where(b).width).toBe(10);

    const plain = setup();
    let c!: NodeId;
    act(() => { c = plain.scene.add({ kind: 'mark', layer: 'main', pose: at(20), data: {} }); });
    expect(plain.where(c).width).toBe(10);
  });

  it('lets a removed node vanish when the seat has no `exit`', () => {
    const { scene, ghosts } = setup();
    act(() => { scene.remove(A); });
    expect(ghosts()).toEqual([]);
  });

  it('sees a removed node off through `exit` as a ghost the scene never holds', () => {
    const { scene, frame, ghosts, departures } = setup({ exit: (p) => ({ ...p, x: p.x + 100 }) });
    const heard = vi.fn();
    departures.subscribe(heard);
    act(() => { scene.remove(A); });
    expect(scene.get(A)).toBeUndefined();
    expect(ghosts()).toEqual([{ id: A, x: 0, alpha: 1 }]);
    frame(0);
    frame(50);
    expect(ghosts()[0]!.x).toBeCloseTo(50);
    expect(ghosts()[0]!.alpha).toBeCloseTo(0.5);
    expect(heard).toHaveBeenCalled();
    frame(100);
    expect(ghosts()).toEqual([]);
    // The ghost recorded nothing: one undo is the removal's, and the last.
    act(() => { scene.undo(); });
    expect(scene.get(A)).toBeDefined();
    expect(scene.canUndo()).toBe(false);
  });

  it('drops the ghost when an undo brings its node back, which returns from where the ghost was', () => {
    const { scene, frame, ghosts, where } = setup({ exit: (p) => ({ ...p, x: p.x + 100 }) });
    act(() => { scene.remove(A); });
    frame(0);
    frame(40);
    act(() => { scene.undo(); });
    expect(ghosts()).toEqual([]);
    expect(where().x).toBeCloseTo(40);
    frame(80);
    expect(where().x).toBeCloseTo(24);
    frame(140);
    expect(where().x).toBe(0);
  });

  it('leaves a removal `exits` turns down, and an untracked one by default, to vanish', () => {
    const declined = setup({ exit: (p) => p, exits: () => false });
    act(() => { declined.scene.remove(A); });
    expect(declined.ghosts()).toEqual([]);

    const untracked = setup({ exit: (p) => p });
    act(() => { untracked.scene.untracked(() => untracked.scene.remove(A)); });
    expect(untracked.ghosts()).toEqual([]);
  });
});
