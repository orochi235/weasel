import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { createScene } from '../core/scene/scene';
import { effectivePose } from '../core/scene/effectivePose';
import { scenePoseFrame } from '../interactions/actions/poseFrame';
import type { RectPose } from '../core/scene/types';
import { sceneToAdapter } from '../canvas/sceneAdapter';
import { moveGestureAdapter } from '../interactions/actions/move/gestureAdapter';
import { useAnimator } from '@weasel-js/animator/react';
import { springPose, tweenPose, type PoseAnimationAdapter } from './poseHelpers';
import type { Animator } from '@weasel-js/animator';

function setup(options: Parameters<typeof sceneToAdapter>[1] = {}) {
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
  const adapter = sceneToAdapter(scene, options as never) as unknown as PoseAnimationAdapter<RectPose>;
  const shown = () => effectivePose(scene, scene.get(a)!);
  return { animator: (): Animator => result.current, frame, scene, a, adapter, shown };
}

const at = (x: number, y = 0): RectPose => ({ x, y, width: 10, height: 10 });

describe('tweenPose on a scene', () => {
  it('commits the destination at once and shows the travel, with no write per frame', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100, easing: linear }); });
    const version = scene.getVersion();
    expect(scene.get(a)!.pose.x).toBe(100);
    expect(moveGestureAdapter(scene).getPose(a).x).toBe(100);
    expect(shown().x).toBeCloseTo(0);
    frame(0);
    frame(50);
    expect(shown().x).toBeCloseTo(50);
    expect(scene.get(a)!.pose.x).toBe(100);
    frame(100);
    expect(shown().x).toBe(100);
    expect(scene.overrides.has(a)).toBe(false);
    expect(scene.getVersion()).toBe(version);
  });

  it('adds a second move to the first, and neither cancels the other', () => {
    const { animator, frame, a, adapter, shown } = setup();
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100, easing: linear }); });
    frame(0);
    frame(50);
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(200), ms: 100, easing: linear }); });
    expect(animator().live().filter((r) => r.key === `pose:${a}`)).toHaveLength(2);
    expect(shown().x).toBeCloseTo(50);
    frame(75);
    // The first has 25 of its 100 left, the second 75 of its own 100.
    expect(shown().x).toBeCloseTo(200 - 25 - 75);
    frame(150);
    expect(shown().x).toBe(200);
    expect(animator().isActive(`pose:${a}`)).toBe(false);
  });

  it('records one undoable step, and none with recordOp off', () => {
    const { animator, frame, scene, a, adapter } = setup();
    const before = scene.historyEntries().length;
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100 }); });
    frame(0);
    frame(100);
    expect(scene.historyEntries().length).toBe(before + 1);
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(0), ms: 100, recordOp: false }); });
    frame(100);
    frame(200);
    expect(scene.get(a)!.pose.x).toBe(0);
    expect(scene.historyEntries().length).toBe(before + 1);
  });

  it('rests on the undone pose when the move is undone mid-flight', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100, easing: linear }); });
    frame(0);
    frame(50);
    act(() => { scene.undo(); });
    expect(scene.get(a)!.pose.x).toBe(0);
    // The writer wins: the next frame shows what it wrote, with nothing left to travel.
    frame(60);
    expect(shown().x).toBe(0);
    expect(animator().isActive(`pose:${a}`)).toBe(false);
    frame(100);
    frame(116);
    expect(shown().x).toBe(0);
    expect(scene.get(a)!.pose.x).toBe(0);
    expect(scene.overrides.has(a)).toBe(false);
    act(() => { scene.redo(); });
    expect(shown().x).toBe(100);
  });

  it('stays where it is shown when canceled, and that is where the document is left', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100, easing: linear }); });
    frame(0);
    frame(40);
    act(() => { animator().cancelKey(`pose:${a}`); });
    expect(shown().x).toBeCloseTo(40);
    expect(scene.get(a)!.pose.x).toBeCloseTo(40);
    frame(56);
    expect(scene.overrides.has(a)).toBe(false);
    expect(shown().x).toBeCloseTo(40);
  });

  it('starts from a given pose without writing it', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    act(() => { tweenPose(animator(), adapter, { id: a, from: at(-50), to: at(0), ms: 100, easing: linear, recordOp: false }); });
    expect(shown().x).toBeCloseTo(-50);
    expect(scene.get(a)!.pose.x).toBe(0);
    frame(0);
    frame(100);
    expect(shown().x).toBe(0);
  });

  it('follows the lerp of a geometry the caller passed', () => {
    const { animator, frame, a, adapter, shown } = setup();
    const geometry = {
      getBounds: (p: RectPose) => p,
      remapBounds: (p: RectPose) => p,
      fromBounds: (b: RectPose) => b,
      lerp: (from: RectPose, to: RectPose, t: number): RectPose => ({ ...to, x: from.x + (to.x - from.x) * t * t }),
    };
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(100), ms: 100, easing: linear, geometry }); });
    frame(0);
    frame(50);
    expect(shown().x).toBeCloseTo(25);
  });
});

describe('springPose on a scene', () => {
  it('interrupts the moves on its node and starts at their velocity', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(100), ms: 1000, easing: linear }); });
    frame(0);
    frame(500);
    act(() => { springPose(animator(), adapter, { id: a, to: at(50) }); });
    expect(animator().live().filter((r) => r.key === `pose:${a}`)).toHaveLength(1);
    expect(scene.get(a)!.pose.x).toBe(50);
    expect(shown().x).toBeCloseTo(50);
    frame(516);
    // It reached its destination moving at 100 a second, so it runs past it first.
    expect(shown().x).toBeGreaterThan(50.5);
    for (let t = 532; t < 4000; t += 16) frame(t);
    expect(shown().x).toBe(50);
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('does not move the pose on screen as it interrupts', () => {
    const { animator, frame, a, adapter, shown } = setup();
    act(() => { tweenPose(animator(), adapter, { id: a, to: at(100), ms: 1000, easing: linear }); });
    frame(0);
    frame(300);
    const before = shown().x;
    act(() => { springPose(animator(), adapter, { id: a, to: at(400, 80) }); });
    expect(shown().x).toBeCloseTo(before);
    expect(shown().y).toBeCloseTo(0);
  });
});

describe('a container whose pose is a frame', () => {
  function family() {
    const s = setup();
    const box = s.scene.add({ kind: 'group', layer: 'main', pose: at(0), data: {} });
    const child = s.scene.add({ kind: 'mark', layer: 'main', pose: at(5), data: {}, parent: box });
    const shownX = (id: typeof box): number => (scenePoseFrame(s.scene as never).world(id) as RectPose).x;
    return { ...s, box, child, shownX };
  }

  it('moves on its target, its children traveling in its frame with no pose of their own written', () => {
    const { animator, frame, scene, adapter, box, child, shownX } = family();
    act(() => { tweenPose(animator(), adapter, { id: box, to: at(100), ms: 100, easing: linear, recordOp: false }); });
    expect(scene.get(box)!.pose.x).toBe(100);
    expect(scene.get(child)!.pose.x).toBe(5);
    frame(0);
    frame(50);
    expect(shownX(box)).toBeCloseTo(50);
    expect(shownX(child)).toBeCloseTo(55);
    frame(100);
    frame(116);
    expect(shownX(child)).toBe(105);
    expect(scene.overrides.has(child)).toBe(false);
  });

  it('records the move as one step that undo takes back', () => {
    const { animator, frame, scene, adapter, box, child, shownX } = family();
    const entries = scene.historyEntries().length;
    act(() => { tweenPose(animator(), adapter, { id: box, to: at(100), ms: 100, easing: linear }); });
    frame(0);
    frame(100);
    frame(116);
    expect(scene.historyEntries().length).toBe(entries + 1);
    scene.undo();
    expect(scene.get(box)!.pose.x).toBe(0);
    expect(shownX(child)).toBe(5);
  });
});
