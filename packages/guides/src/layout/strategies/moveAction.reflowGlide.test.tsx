/**
 * A drag under an animated reflow: the dropped child lands the way its
 * siblings do, and a node caught mid-glide is picked up where it is shown.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import {
  composeRectPose,
  createReflowTransition,
  decomposeRectPose,
  createScene,
  effectivePose,
  moveAction,
  useAnimator,
  type InvocationCtx,
  type LayoutDep,
  type NodeId,
  type OngoingHandle,
  type OngoingInvoker,
  type RectPose,
  type ReflowTransition,
} from '@weasel-js/core';
import { tileGrid } from './tileGrid';

type Drag = { start: { x: number; y: number }; current: { x: number; y: number }; delta: { x: number; y: number } };

const box = (x: number, y = 0, w = 50, h = 100): RectPose => ({ x, y, width: w, height: h });

/** A two-cell row `C` holding `a` and `b`, and a transition on a manual clock. */
function setup() {
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
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const C = scene.add({ kind: 'container', layer: 'main', data: {}, pose: box(0, 0, 100, 100) });
  const a = scene.add({ kind: 'leaf', parent: C, layer: 'main', data: {}, pose: box(0) });
  const b = scene.add({ kind: 'leaf', parent: C, layer: 'main', data: {}, pose: box(50) });
  const reflow = createReflowTransition(scene, result.current, { ms: 100, easing: linear });
  const grid = tileGrid<RectPose>({ cols: 2, rows: 1 });
  const layout: LayoutDep = {
    getLayout: (id) => (id === C ? (grid as never) : null),
    reflow: reflow as ReflowTransition<unknown>,
  };
  const ctx = (drag?: Drag): InvocationCtx => ({
    world: drag ? drag.current : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => [a] }, scene, layout },
    drag,
  }) as unknown as InvocationCtx;
  const grab = (): OngoingHandle => (moveAction.invoker as OngoingInvoker).start(ctx(), {}) as OngoingHandle;
  const where = (id: NodeId) => effectivePose(scene, scene.get(id)!);
  return { scene, a, b, frame, ctx, grab, where, layout };
}

const drag = (from: number, to: number): Drag => ({
  start: { x: from, y: 50 },
  current: { x: to, y: 50 },
  delta: { x: to - from, y: 0 },
});

describe('moveAction under a reflow transition', () => {
  it('glides the dropped child from where it was released to its slot', () => {
    const { scene, a, frame, ctx, grab, where } = setup();
    const h = grab();
    // Released 15 past the second cell's origin.
    h.onMove!(ctx(drag(25, 90)));
    act(() => { h.onEnd!(ctx(drag(25, 90)), 'commit'); });
    expect(scene.get(a)!.pose.x).toBe(50);
    expect(where(a).x).toBe(65);
    frame(0);
    frame(50);
    expect(where(a).x).toBeCloseTo(57.5);
    frame(100);
    expect(where(a).x).toBe(50);
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('keeps the drop one undo step', () => {
    const { scene, a, b, frame, ctx, grab } = setup();
    const before = scene.historyEntries().length;
    const h = grab();
    h.onMove!(ctx(drag(25, 90)));
    act(() => { h.onEnd!(ctx(drag(25, 90)), 'commit'); });
    frame(0);
    frame(100);
    expect(scene.historyEntries().length).toBe(before + 1);
    scene.undo();
    expect(scene.get(a)!.pose.x).toBe(0);
    expect(scene.get(b)!.pose.x).toBe(50);
  });

  it('glides a canceled drag home from where it was let go', () => {
    const { scene, a, frame, ctx, grab, where } = setup();
    const h = grab();
    h.onMove!(ctx(drag(25, 65)));
    act(() => { h.onEnd!(ctx(drag(25, 65)), 'cancel'); });
    expect(scene.get(a)!.pose.x).toBe(0);
    expect(where(a).x).toBe(40);
    frame(0);
    frame(50);
    expect(where(a).x).toBeCloseTo(20);
    frame(100);
    expect(where(a).x).toBe(0);
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('starts the glide in the frame of the container the child landed in', () => {
    const { scene, a, frame, ctx, where, layout } = setup();
    const D = scene.add({ kind: 'container', layer: 'main', data: {}, pose: box(200, 0, 100, 100) });
    const grid = layout.getLayout(scene.get(a)!.parent as string);
    layout.getLayout = (id) => (id === D || id === scene.get(a)?.parent ? grid : null);
    const local = (c: InvocationCtx): InvocationCtx => {
      c.deps.poseComposition = { compose: composeRectPose, decompose: decomposeRectPose };
      return c;
    };
    const h = (moveAction.invoker as OngoingInvoker).start(local(ctx()), {}) as OngoingHandle;
    // Released 15 past D's second cell, which sits at 50 in D's frame.
    h.onMove!(local(ctx(drag(25, 290))));
    act(() => { h.onEnd!(local(ctx(drag(25, 290))), 'commit'); });
    expect(scene.get(a)!.parent).toBe(D);
    expect(scene.get(a)!.pose.x).toBe(50);
    expect(where(a).x).toBe(65);
    frame(0);
    frame(100);
    expect(where(a).x).toBe(50);
  });

  /** Drop `a` 15 past its slot and stop the clock halfway through its glide. */
  function midGlide() {
    const s = setup();
    const h = s.grab();
    h.onMove!(s.ctx(drag(25, 90)));
    act(() => { h.onEnd!(s.ctx(drag(25, 90)), 'commit'); });
    s.frame(0);
    s.frame(50);
    expect(s.where(s.a).x).toBeCloseTo(57.5);
    return s;
  }

  it('picks up a node mid-glide where it is shown, not where its document says', () => {
    const { a, ctx, grab, where } = midGlide();
    const h = grab();
    expect(where(a).x).toBeCloseTo(57.5);
    h.onMove!(ctx(drag(80, 90)));
    expect(where(a).x).toBeCloseTo(67.5);
  });

  it('stops the glide it caught, so the clock no longer moves the node', () => {
    const { a, frame, grab, where } = midGlide();
    grab();
    frame(75);
    frame(100);
    expect(where(a).x).toBeCloseTo(57.5);
  });

  it('commits a free drop of a caught node where it was shown under the pointer', () => {
    const { scene, a, ctx, grab, where } = midGlide();
    const h = grab();
    h.onMove!(ctx(drag(80, 380)));
    act(() => { h.onEnd!(ctx(drag(80, 380)), 'commit'); });
    expect(scene.get(a)!.pose.x).toBeCloseTo(357.5);
    expect(where(a).x).toBeCloseTo(357.5);
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('lets a caught node that is only clicked finish settling into its slot', () => {
    const { scene, a, frame, ctx, grab, where } = midGlide();
    const h = grab();
    act(() => { h.onEnd!(ctx(), 'commit'); });
    expect(where(a).x).toBeCloseTo(57.5);
    frame(100);
    frame(200);
    expect(where(a).x).toBe(50);
    expect(scene.overrides.has(a)).toBe(false);
  });
});
