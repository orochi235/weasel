import { describe, expect, it } from 'vitest';
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
    initial: [{ id: A, kind: 'leaf', layer: 'main', pose: at(0), data: {} }],
  });
  const transition = createReflowTransition(scene, result.current, { ms: 100, easing: linear });
  bindPoseTransition(scene, () => ({ transition, ...seat }));
  const where = (id: NodeId = A) => effectivePose(scene, scene.get(id)!);
  return { scene, transition, frame, where };
}

const batchAdapter = (scene: ReturnType<typeof setup>['scene']) => ({
  setPose: (id: string, p: RectPose) => scene.setPose(asNodeId(id), p),
  getPose: (id: string) => scene.get(asNodeId(id))!.pose,
});

describe('bindPoseTransition', () => {
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
    act(() => { b = grown.scene.add({ kind: 'leaf', layer: 'main', pose: at(20), data: {} }); });
    expect(grown.where(b).width).toBe(0);
    grown.frame(0);
    grown.frame(100);
    expect(grown.where(b).width).toBe(10);

    const plain = setup();
    let c!: NodeId;
    act(() => { c = plain.scene.add({ kind: 'leaf', layer: 'main', pose: at(20), data: {} }); });
    expect(plain.where(c).width).toBe(10);
  });
});
