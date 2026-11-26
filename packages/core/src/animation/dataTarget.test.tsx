import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { createScene } from '../core/scene/scene';
import { nodeAsShown } from '../core/scene/nodeAsShown';
import type { RectPose } from '../core/scene/types';
import { useAnimator } from '@weasel-js/animator/react';
import type { Animator } from '@weasel-js/animator';
import { sceneDataTarget, type DataLens } from './dataTarget';

type Data = { opacity: number; color: [number, number, number]; label: string };

const field = <K extends 'opacity' | 'color'>(key: K): DataLens<Data, Data[K]> => ({
  key, get: (d) => d[key], with: (d, v) => ({ ...d, [key]: v }),
});

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
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { opacity: 1, color: [0, 0, 0], label: 'a' } });
  const shown = () => nodeAsShown(scene.overrides, scene.get(a)!).data;
  return { animator: (): Animator => result.current, frame, scene, a, shown };
}

describe('sceneDataTarget', () => {
  it('commits the destination to the stored data and shows the travel through the overrides', () => {
    const { animator, frame, scene, a, shown } = setup();
    const target = sceneDataTarget(scene, a, field('opacity'))!;
    act(() => { animator().tween({ target, to: 0, ms: 100, easing: linear }); });
    expect(scene.get(a)!.data.opacity).toBe(0);
    frame(0);
    frame(50);
    expect(shown().opacity).toBeCloseTo(0.5);
    expect(shown().label).toBe('a');
    frame(100);
    expect(scene.overrides.has(a)).toBe(false);
    expect(shown().opacity).toBe(0);
  });

  it('shows two fields of one node through one ply, and lets go of each as it rests', () => {
    const { animator, frame, scene, a, shown } = setup();
    const opacity = sceneDataTarget(scene, a, field('opacity'))!;
    const color = sceneDataTarget(scene, a, field('color'))!;
    act(() => {
      animator().tween({ target: opacity, to: 0, ms: 100, easing: linear });
      animator().tween({ target: color, to: [1, 1, 1], ms: 200, easing: linear });
    });
    frame(0);
    frame(50);
    expect(shown().opacity).toBeCloseTo(0.5);
    expect(shown().color[0]).toBeCloseTo(0.25);
    frame(150);
    expect(shown().opacity).toBe(0);
    expect(shown().color[0]).toBeCloseTo(0.75);
    frame(200);
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('answers the same target for one field, and none for a node not in the scene', () => {
    const { scene, a } = setup();
    expect(sceneDataTarget(scene, a, field('opacity'))).toBe(sceneDataTarget(scene, a, field('opacity')));
    expect(sceneDataTarget(scene, 'nope', field('opacity'))).toBeUndefined();
  });
});
