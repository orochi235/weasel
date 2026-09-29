import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { createScene } from '../core/scene/scene';
import { effectivePose } from '../core/scene/effectivePose';
import type { NodeId, RectPose } from '../core/scene/types';
import { useAnimator } from './useAnimator';
import { createReflowTransition, useAnimatedReflow, type ReflowTransitionOptions } from './reflow';
import type { Animator, AnimatorEvent } from './types';

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
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
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
    // Halfway along the new leg: from (50, 0) toward (0, 80).
    expect(where(a).x).toBeCloseTo(25);
    expect(where(a).y).toBeCloseTo(40);
    frame(150);
    expect(where(a)).toMatchObject({ x: 0, y: 80 });
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

  it('claims one cancelKey per node, so a new target steals the running glide', () => {
    const { animator, frame, scene, a } = setup();
    const events: AnimatorEvent[] = [];
    animator().watch((e) => events.push(e));
    const reflow = createReflowTransition(scene, animator(), TWEEN);
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
    frame(100);
    expect(where(a).x).toBeCloseTo(75);
    frame(150);
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
