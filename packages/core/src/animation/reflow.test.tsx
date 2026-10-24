import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { createScene } from '../core/scene/scene';
import { effectivePose } from '../core/scene/effectivePose';
import type { NodeId, RectPose } from '../core/scene/types';
import { useAnimator } from '@weasel-js/animator/react';
import { createReflowTransition, useAnimatedReflow, type ReflowTransitionOptions } from './reflow';
import type { Animator, AnimatorEvent } from '@weasel-js/animator';

/** Manual frame pump over the animator's injected clock. */
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
  const a = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
  const where = (id: NodeId) => effectivePose(scene, scene.get(id)!);
  return { animator: (): Animator => result.current, frame, scene, a, where };
}

const TWEEN: ReflowTransitionOptions<RectPose> = { ms: 100, easing: linear };
const at = (x: number, y = 0): RectPose => ({ x, y, width: 10, height: 10 });

describe('createReflowTransition', () => {
  it('glides from where the node is shown to the target, then holds it there', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    expect(where(a).x).toBe(0);
    frame(0);
    frame(50);
    expect(where(a).x).toBeCloseTo(50);
    frame(100);
    expect(where(a).x).toBe(100);
    frame(200);
    // Held by the override; the document never moved.
    expect(where(a).x).toBe(100);
    expect(scene.get(a)!.pose.x).toBe(0);
    expect(reflow.poseOf(a)?.x).toBe(100);
  });

  it('retargets mid-glide from the pose on screen, with no jump', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    const shown = where(a).x;
    act(() => { reflow.glide(a, at(0, 80)); });
    expect(where(a).x).toBeCloseTo(shown);
    frame(50);
    expect(where(a).x).toBeCloseTo(shown);
    frame(100);
    // The first leg is done; the second has half of its own (100, -80) left.
    expect(where(a).x).toBeCloseTo(50);
    expect(where(a).y).toBeCloseTo(40);
    frame(150);
    expect(where(a)).toMatchObject({ x: 0, y: 80 });
  });

  it('adds a timed retarget to the glide still running, under one key', () => {
    const { animator, frame, scene, a, where } = setup();
    const events: AnimatorEvent[] = [];
    animator().watch((e) => events.push(e));
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    act(() => { reflow.glide(a, at(200)); });
    expect(animator().live().filter((r) => r.key === `reflow:${a}`)).toHaveLength(2);
    expect(events.map((e) => e.type)).toEqual(['start', 'start']);
    frame(75);
    // 25 left of the first leg and 75 of the second.
    expect(where(a).x).toBeCloseTo(200 - 25 - 75);
    expect(reflow.poseOf(a)?.x).toBeCloseTo(100);
  });

  it('carries its velocity into a spring retarget', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), { spring: { stiffness: 1, damping: 1, mass: 1 } });
    act(() => { reflow.glide(a, at(1000)); });
    frame(0);
    for (let t = 16; t <= 480; t += 16) frame(t);
    const before = where(a).x;
    frame(496);
    const step = where(a).x - before;
    expect(step).toBeGreaterThan(0.5);
    // Sent straight down from where it is: a spring starting from rest would not move in x.
    act(() => { reflow.glide(a, at(where(a).x, 50)); });
    expect(animator().live().filter((r) => r.key === `reflow:${a}`)).toHaveLength(1);
    const held = where(a).x;
    frame(512);
    expect(where(a).x - held).toBeGreaterThan(step * 0.8);
  });

  it('keeps its progress when handed the target it is already heading for', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    act(() => { reflow.glide(a, at(100)); });
    frame(100);
    expect(where(a).x).toBe(100);
  });

  it('restarts a glide the animator canceled when asked for the same target again', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    act(() => { animator().cancelAll(); });
    act(() => { reflow.glide(a, at(100)); });
    frame(50);
    frame(150);
    expect(where(a).x).toBe(100);

    act(() => { reflow.settle(a); });
    frame(150);
    frame(200);
    act(() => { animator().cancelKey(`reflow:${a}`); });
    act(() => { reflow.settle(a); });
    frame(200);
    frame(300);
    expect(scene.overrides.get(a)).toBeUndefined();
    expect(where(a).x).toBe(0);
  });

  it('claims one cancelKey per node, so a new spring target steals the running glide', () => {
    const { animator, frame, scene, a } = setup();
    const events: AnimatorEvent[] = [];
    animator().watch((e) => events.push(e));
    const reflow = createReflowTransition(scene, animator(), { spring: { preset: 'stiff' } });
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    act(() => { reflow.glide(a, at(200)); });
    const rows = animator().live().filter((r) => r.key === `reflow:${a}`);
    expect(rows).toHaveLength(1);
    expect(events.map((e) => e.type)).toEqual(['start', 'interrupt', 'start']);
    expect(events.every((e) => e.animation.label === 'reflow')).toBe(true);
  });

  it('lets another animator call under the same key steal the glide', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    act(() => { animator().cancelKey(`reflow:${a}`); });
    frame(100);
    // Stopped where it was, still overridden.
    expect(where(a).x).toBeCloseTo(50);
  });

  it('settles back onto the document pose and then lets go of the node', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(100);
    act(() => { reflow.settle(a); });
    frame(150);
    expect(where(a).x).toBeCloseTo(50);
    expect(scene.overrides.has(a)).toBe(true);
    frame(200);
    expect(where(a).x).toBe(0);
    expect(scene.overrides.has(a)).toBe(false);
    expect(reflow.poseOf(a)).toBeUndefined();
  });

  it('settles onto a document pose that moved while it glided', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    scene.setPose(a, at(100));
    act(() => { reflow.settle(a); });
    frame(75);
    // Already heading there: the glide it is on finishes the job.
    expect(where(a).x).toBeCloseTo(75);
    frame(100);
    expect(scene.overrides.has(a)).toBe(false);
    expect(where(a).x).toBe(100);
  });

  it('stop drops the override at once and cancels the glide', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    act(() => { reflow.stop(a); });
    expect(scene.overrides.has(a)).toBe(false);
    expect(animator().isActive(`reflow:${a}`)).toBe(false);
    frame(100);
    expect(where(a).x).toBe(0);
  });

  it('leaves alone an override something else installed over its own', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    act(() => { reflow.settle(a); });
    const theirs = { pose: at(300) };
    scene.overrides.set(a, theirs);
    frame(200);
    expect(scene.overrides.get(a)).toBe(theirs);
    expect(where(a).x).toBe(300);
  });

  it('glides from a given pose rather than the one on screen', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100), { from: at(200) }); });
    expect(where(a).x).toBe(200);
    frame(0);
    frame(50);
    expect(where(a).x).toBeCloseTo(150);
    frame(100);
    expect(where(a).x).toBe(100);
  });

  it('restarts a running glide from a given pose, even toward the same target', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    act(() => { reflow.glide(a, at(100), { from: at(300) }); });
    expect(where(a).x).toBe(300);
    frame(100);
    expect(where(a).x).toBeCloseTo(200);
  });

  it('holds a node in place when the given pose is its target', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    const shown = reflow.poseOf(a)!;
    act(() => { reflow.glide(a, shown, { from: shown }); });
    expect(animator().isActive(`reflow:${a}`)).toBe(false);
    frame(100);
    expect(where(a).x).toBeCloseTo(50);
    expect(scene.overrides.has(a)).toBe(true);
  });

  it('settles a node it was not moving from a given pose onto its document pose', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.settle(a, { from: at(80) }); });
    expect(where(a).x).toBe(80);
    frame(0);
    frame(50);
    expect(where(a).x).toBeCloseTo(40);
    frame(100);
    expect(where(a).x).toBe(0);
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('settling from a given pose glides under an override laid over its own, which shows until it lets go', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    const over = { pose: at(300) };
    scene.overrides.set(a, over);
    act(() => { reflow.settle(a, { from: at(300) }); });
    frame(100);
    expect(where(a).x).toBe(300);
    scene.overrides.clear(a, over);
    expect(where(a).x).toBeCloseTo(150);
    frame(150);
    expect(where(a).x).toBe(0);
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('leaves a resize\'s preview over its glide when it retargets or settles mid-resize', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(50);
    const resize = scene.overrides.hold();
    resize.set([[a, { x: 40, y: 0, width: 30, height: 30 }]]);
    act(() => { reflow.glide(a, at(200)); });
    expect(where(a)).toEqual({ x: 40, y: 0, width: 30, height: 30 });
    act(() => { reflow.settle(a); });
    frame(75);
    expect(where(a)).toEqual({ x: 40, y: 0, width: 30, height: 30 });
    resize.drop();
    expect(scene.overrides.has(a)).toBe(true);
    expect(where(a)).not.toEqual({ x: 40, y: 0, width: 30, height: 30 });
  });

  it('settling from the document pose itself leaves nothing behind', () => {
    const { animator, scene, a } = setup();
    const reflow = createReflowTransition(scene, animator(), TWEEN);
    act(() => { reflow.settle(a, { from: at(0) }); });
    expect(scene.overrides.has(a)).toBe(false);
    expect(reflow.poseOf(a)).toBeUndefined();
    expect(animator().isActive(`reflow:${a}`)).toBe(false);
  });

  it('springs to the target when given a spring', () => {
    const { animator, frame, scene, a, where } = setup();
    const reflow = createReflowTransition(scene, animator(), { spring: { preset: 'stiff' } });
    act(() => { reflow.glide(a, at(100)); });
    frame(0);
    frame(16);
    expect(where(a).x).toBeGreaterThan(0);
    for (let t = 32; t < 3000; t += 16) frame(t);
    expect(where(a).x).toBeCloseTo(100, 1);
    expect(animator().isActive(`reflow:${a}`)).toBe(false);
  });
});

describe('useAnimatedReflow', () => {
  it('is null until given options, and drops its overrides when turned off', () => {
    const { animator, frame, scene, a } = setup();
    const { result, rerender } = renderHook(
      ({ opts }: { opts: ReflowTransitionOptions<RectPose> | null }) => useAnimatedReflow(scene, animator(), opts),
      { initialProps: { opts: null as ReflowTransitionOptions<RectPose> | null } },
    );
    expect(result.current).toBeNull();
    rerender({ opts: TWEEN });
    act(() => { result.current!.glide(a, at(100)); });
    frame(0);
    frame(50);
    expect(scene.overrides.has(a)).toBe(true);
    rerender({ opts: null });
    expect(result.current).toBeNull();
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('reads a changed duration without rebuilding', () => {
    const { animator, frame, scene, a, where } = setup();
    const { result, rerender } = renderHook(
      ({ opts }: { opts: ReflowTransitionOptions<RectPose> }) => useAnimatedReflow(scene, animator(), opts),
      { initialProps: { opts: TWEEN } },
    );
    const first = result.current;
    rerender({ opts: { ms: 200, easing: linear } });
    expect(result.current).toBe(first);
    act(() => { result.current!.glide(a, at(100)); });
    frame(0);
    frame(100);
    expect(where(a).x).toBeCloseTo(50);
  });
});
