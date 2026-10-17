import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { createScene } from '../core/scene/scene';
import { effectivePose } from '../core/scene/effectivePose';
import type { RectPose } from '../core/scene/types';
import { sceneToAdapter } from '../canvas/sceneAdapter';
import { useAnimator } from '@weasel-js/animator/react';
import { springPose, tweenPose, type PoseAnimationAdapter } from './poseHelpers';
import type { Animator } from '@weasel-js/animator';

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
  const adapter = sceneToAdapter(scene) as unknown as PoseAnimationAdapter<RectPose>;
  const shown = () => effectivePose(scene, scene.get(a)!);
  return { animator: (): Animator => result.current, frame, scene, a, adapter, shown };
}

const at = (x: number, y = 0): RectPose => ({ x, y, width: 10, height: 10 });

describe('tweenPose with `rewind`', () => {
  it('travels back the way it came when the move is undone mid-flight', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    let done = 0;
    act(() => {
      tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100, easing: linear, rewind: true, onDone: () => { done += 1; } });
    });
    frame(0);
    frame(50);
    expect(shown().x).toBeCloseTo(50);
    const entries = scene.historyEntries().length;
    act(() => { scene.undo(); });
    expect(scene.get(a)!.pose.x).toBe(0);
    // The frame that finds the move undone turns it around where that frame had brought it.
    frame(60);
    expect(shown().x).toBeCloseTo(60);
    expect(animator().isActive(`pose:${a}`)).toBe(true);
    frame(90);
    expect(shown().x).toBeCloseTo(30);
    expect(scene.get(a)!.pose.x).toBe(0);
    frame(120);
    frame(136);
    expect(shown().x).toBe(0);
    expect(animator().isActive(`pose:${a}`)).toBe(false);
    expect(scene.overrides.has(a)).toBe(false);
    expect(scene.historyEntries().length).toBe(entries);
    expect(done).toBe(0);
  });

  it('turns forward again when the undo is redone, and is done once it arrives', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    let done = 0;
    act(() => {
      tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100, easing: linear, rewind: true, onDone: () => { done += 1; } });
    });
    frame(0);
    frame(50);
    act(() => { scene.undo(); });
    frame(60);
    frame(80);
    expect(shown().x).toBeCloseTo(40);
    act(() => { scene.redo(); });
    expect(scene.get(a)!.pose.x).toBe(100);
    frame(90);
    expect(shown().x).toBeCloseTo(30);
    frame(105);
    expect(shown().x).toBeCloseTo(45);
    // It had 30 of its 100 ms behind it when it turned, so it arrives 70 after.
    frame(159);
    expect(done).toBe(0);
    expect(shown().x).toBeCloseTo(99);
    frame(160);
    frame(176);
    expect(shown().x).toBe(100);
    expect(done).toBe(1);
    expect(animator().isActive(`pose:${a}`)).toBe(false);
  });

  it('follows its easing back, so the pose retraces the positions it passed', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    const ease = (u: number) => u * u;
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100, easing: ease, rewind: true }); });
    frame(0);
    frame(40);
    const passed = shown().x;
    expect(passed).toBeCloseTo(16);
    frame(80);
    act(() => { scene.undo(); });
    frame(80);
    expect(shown().x).toBeCloseTo(64);
    // 40 ms back along the 80 it traveled is where it stood at 40.
    frame(120);
    expect(shown().x).toBeCloseTo(passed);
  });

  it('still lets any other write win at once', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100, easing: linear, rewind: true }); });
    frame(0);
    frame(50);
    act(() => { scene.setPose(a, at(7)); });
    frame(60);
    expect(shown().x).toBe(7);
    expect(animator().isActive(`pose:${a}`)).toBe(false);
  });

  it('answers through its handle whichever way it is traveling', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    let handle: ReturnType<typeof tweenPose> | undefined;
    act(() => { handle = tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100, easing: linear, rewind: true }); });
    frame(0);
    frame(50);
    act(() => { scene.undo(); });
    frame(60);
    frame(80);
    act(() => { handle!.pause(); });
    expect(handle!.isPaused()).toBe(true);
    frame(100);
    expect(shown().x).toBeCloseTo(40);
    act(() => { animator().cancel(handle!); });
    expect(animator().isActive(`pose:${a}`)).toBe(false);
  });
});

describe('springPose with `rewind`', () => {
  it('springs back to the undone pose from where it is, with no jump', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    let done = 0;
    act(() => {
      springPose(animator(), adapter, { id: a, to: at(100), stiffness: 100, damping: 20, rewind: true, onDone: () => { done += 1; } });
    });
    frame(0);
    for (let t = 16; t <= 160; t += 16) frame(t);
    const before = shown().x;
    expect(before).toBeGreaterThan(5);
    expect(before).toBeLessThan(95);
    const entries = scene.historyEntries().length;
    act(() => { scene.undo(); });
    frame(176);
    // Still carrying the speed it had, so it has moved on a little and not snapped to 0.
    expect(shown().x).toBeGreaterThan(before);
    expect(shown().x).toBeLessThan(before + 30);
    let last = shown().x;
    let fell = false;
    for (let t = 192; t <= 4000; t += 16) {
      frame(t);
      if (shown().x < last - 1e-6) fell = true;
      last = shown().x;
    }
    expect(fell).toBe(true);
    expect(shown().x).toBe(0);
    expect(scene.get(a)!.pose.x).toBe(0);
    expect(animator().isActive(`pose:${a}`)).toBe(false);
    expect(scene.historyEntries().length).toBe(entries);
    expect(done).toBe(0);
  });
});
