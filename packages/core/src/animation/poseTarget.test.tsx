import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { createScene } from '../core/scene/scene';
import { effectivePose } from '../core/scene/effectivePose';
import { RECT_POSE_DESCRIPTOR } from '../core/geometry/poseDescriptor';
import type { NodeId, RectPose } from '../core/scene/types';
import { useAnimator } from '@weasel-js/animator/react';
import { createPoseTarget, poseAxes, scenePoseTarget } from './poseTarget';
import type { Animator } from '@weasel-js/animator';

type Pose = RectPose & { rotation?: number };

function setup(pose: Pose = { x: 0, y: 0, width: 10, height: 10 }) {
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
  const scene = createScene<object, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', pose, data: {} });
  const shown = (id: NodeId = a) => effectivePose(scene, scene.get(id)!);
  return { animator: (): Animator => result.current, frame, scene, a, shown };
}

const at = (x: number, y = 0): Pose => ({ x, y, width: 10, height: 10 });

describe('createPoseTarget', () => {
  it('commits the destination to its owner and shows the travel through the overrides', () => {
    const { animator, frame, scene, a, shown } = setup();
    let committed: Pose = at(0);
    const target = createPoseTarget<Pose>({
      id: a, get: () => committed, set: (p) => { committed = p; }, overrides: scene.overrides,
    });
    act(() => { animator().tween({ target, to: at(100), ms: 100, easing: linear }); });
    expect(committed.x).toBe(100);
    // Shown from the start, so no frame paints the destination early.
    expect(scene.overrides.read(a)?.pose?.x).toBeCloseTo(0);
    frame(0);
    frame(50);
    expect(shown().x).toBeCloseTo(50);
    frame(100);
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('leaves alone an override laid over its own while it moves', () => {
    const { animator, frame, scene, a } = setup();
    const target = scenePoseTarget(scene, a)!;
    act(() => { animator().tween({ target, to: at(100), ms: 100, easing: linear }); });
    frame(0);
    const drag = { pose: at(7) };
    scene.overrides.set(a, drag);
    frame(50);
    expect(scene.overrides.get(a)).toBe(drag);
    frame(100);
    expect(scene.overrides.get(a)).toBe(drag);
  });

  it('refuses a pose it cannot map to numbers', () => {
    const { scene, a } = setup();
    expect(() => createPoseTarget<unknown>({
      id: a, get: () => ({ points: [{ x: 0, y: 0 }] }), set: () => {}, overrides: scene.overrides as never,
    })).toThrow('axes');
  });
});

describe('scenePoseTarget', () => {
  it('hands back one target per node', () => {
    const { scene, a } = setup();
    expect(scenePoseTarget(scene, a)).toBe(scenePoseTarget(scene, a));
  });

  it('commits to the document without recording, and the node rests there', () => {
    const { animator, frame, scene, a, shown } = setup();
    const entries = scene.historyEntries().length;
    act(() => { animator().tween({ target: scenePoseTarget(scene, a)!, to: at(100), ms: 100, easing: linear }); });
    expect(scene.get(a)!.pose.x).toBe(100);
    expect(shown().x).toBeCloseTo(0);
    frame(0);
    frame(100);
    expect(shown().x).toBe(100);
    expect(scene.historyEntries().length).toBe(entries);
  });

  it('has none for a node that is not there, or whose pose has no axes', () => {
    const { scene } = setup();
    expect(scenePoseTarget(scene, 'nope')).toBeUndefined();
    const paths = createScene<object, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
    const p = paths.add({ kind: 'mark', layer: 'main', pose: { kind: 'polygon', points: [] }, data: {} });
    expect(scenePoseTarget(paths, p)).toBeUndefined();
  });

  it('keeps the fields of the pose it does not move as they are in the document', () => {
    const { animator, frame, scene, a, shown } = setup();
    const target = scenePoseTarget(scene, a)!;
    act(() => { animator().tween({ target, to: at(100), ms: 100, easing: linear }); });
    frame(0);
    scene.setPose(a, { ...at(100), tag: 'later' } as Pose);
    frame(50);
    expect((shown() as Pose & { tag?: string }).tag).toBe('later');
  });
});

describe('poseAxes', () => {
  it('reads a rect pose through its descriptor, with rotation as an angle', () => {
    const axes = poseAxes<Pose>(RECT_POSE_DESCRIPTOR, at(0))!;
    expect(axes.count).toBe(5);
    expect(axes.angles).toEqual([4]);
    expect(axes.to({ ...at(3, 4), rotation: 1 })).toEqual([3, 4, 10, 10, 1]);
    expect(axes.from([1, 2, 3, 4, 0])).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(axes.from([1, 2, 3, 4, 0.5])).toMatchObject({ rotation: 0.5 });
  });

  it('falls back to the flat fields of a pose the descriptor does not map', () => {
    const axes = poseAxes<unknown>(RECT_POSE_DESCRIPTOR as never, { cx: 1, cy: 2, r: 3 })!;
    expect(axes.to({ cx: 1, cy: 2, r: 3 })).toEqual([1, 2, 3]);
  });

  it('turns a rect the short way round', () => {
    const { animator, frame, scene, a, shown } = setup({ ...at(0), rotation: 0.1 });
    const target = scenePoseTarget(scene, a)!;
    act(() => {
      animator().tween({ target, to: { ...at(0), rotation: Math.PI * 2 - 0.1 }, ms: 100, easing: linear });
    });
    frame(0);
    frame(50);
    // Through zero, not back through half a turn.
    expect(Math.cos(shown().rotation!)).toBeCloseTo(1, 6);
  });
});
