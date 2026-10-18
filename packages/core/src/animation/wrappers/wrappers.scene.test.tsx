import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { createScene } from '../../core/scene/scene';
import { effectivePose } from '../../core/scene/effectivePose';
import { asNodeId, type RectPose } from '../../core/scene/types';
import { sceneToAdapter } from '../../canvas/sceneAdapter';
import { useAnimator } from '@weasel-js/animator/react';
import { animateLifecycle } from './animateLifecycle';
import { animateOnSetPose } from './animateOnSetPose';
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
  const shown = (id: string = a) => effectivePose(scene, scene.get(asNodeId(id))!);
  const adapter = sceneToAdapter(scene);
  return { animator: (): Animator => result.current, frame, scene, a, adapter, shown };
}

const at = (x: number, size = 10): RectPose => ({ x, y: 0, width: size, height: size });

describe('animateOnSetPose over a scene', () => {
  it('writes the pose at once and glides the node to it', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    const wrapped = animateOnSetPose(adapter, animator(), { ms: 100, easing: linear });
    act(() => { wrapped.setPose(a, at(100)); });
    expect(scene.get(a)!.pose.x).toBe(100);
    expect(shown().x).toBeCloseTo(0);
    frame(0);
    frame(50);
    expect(shown().x).toBeCloseTo(50);
  });

  it('bends a glide toward a second write instead of ending it', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    const wrapped = animateOnSetPose(adapter, animator(), { ms: 100, easing: linear });
    act(() => { wrapped.setPose(a, at(100)); });
    frame(0);
    frame(50);
    act(() => { wrapped.setPose(a, at(0)); });
    expect(scene.get(a)!.pose.x).toBe(0);
    expect(shown().x).toBeCloseTo(50);
    frame(75);
    expect(shown().x).toBeCloseTo(0 + 25 + 75 - 50);
    frame(150);
    expect(shown().x).toBe(0);
  });

  it('springs a second write from the velocity of the first', () => {
    const { animator, frame, a, adapter, shown } = setup();
    const wrapped = animateOnSetPose(adapter, animator(), { spring: { stiffness: 1, damping: 1, mass: 1 } });
    act(() => { wrapped.setPose(a, at(1000)); });
    frame(0);
    for (let t = 16; t <= 480; t += 16) frame(t);
    const before = shown().x;
    frame(496);
    const speed = shown().x - before;
    act(() => { wrapped.setPose(a, at(shown().x)); });
    frame(512);
    expect(shown().x - before - speed).toBeGreaterThan(speed * 0.8);
  });
});

describe('animateLifecycle over a scene', () => {
  const node = (id: string, pose: RectPose) =>
    ({ id: asNodeId(id), kind: 'leaf' as const, layer: 'main' as const, pose, data: {}, parent: null });

  it('enters from the start pose without ever writing it to the document', () => {
    const { animator, frame, scene, adapter, shown } = setup();
    const wrapped = animateLifecycle(adapter, animator(), {
      enterFrom: (p) => ({ ...p, width: 0, height: 0 }), ms: 100, easing: linear,
    });
    act(() => { wrapped.insertNode(node('n', at(5, 20))); });
    expect(scene.get(asNodeId('n'))!.pose.width).toBe(20);
    expect(shown('n').width).toBeCloseTo(0);
    frame(0);
    frame(50);
    expect(shown('n').width).toBeCloseTo(10);
    frame(100);
    expect(shown('n').width).toBe(20);
    act(() => { scene.undo(); });
    expect(scene.get(asNodeId('n'))).toBeUndefined();
  });

  it('shrinks a node out, removes it, and restores it whole on undo', () => {
    const { animator, frame, scene, a, adapter, shown } = setup();
    const wrapped = animateLifecycle(adapter, animator(), {
      exitTo: (p) => ({ ...p, width: 0, height: 0 }), ms: 100, easing: linear,
    });
    act(() => { wrapped.removeNode(a); });
    frame(0);
    frame(50);
    expect(shown().width).toBeCloseTo(5);
    frame(100);
    expect(scene.get(a)).toBeUndefined();
    expect(scene.overrides.has(a)).toBe(false);
    act(() => { scene.undo(); });
    expect(scene.get(a)!.pose.width).toBe(10);
  });
});
