import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear, PATH_L, PATH_M, PATH_Z, type Path } from '@weasel-js/geom';
import { createScene } from '../core/scene/scene';
import { effectivePose } from '../core/scene/effectivePose';
import { sceneToAdapter } from '../canvas/sceneAdapter';
import { useAnimator } from '@weasel-js/animator/react';
import { tweenPose, type PoseAnimationAdapter } from './poseHelpers';

/** A polygon of `n` points along y = 0 from `x`, one unit apart. */
const poly = (x: number, n = 3): Path => ({
  kind: 'polygon',
  commands: Uint8Array.of(PATH_M, ...new Array<number>(n - 1).fill(PATH_L), PATH_Z),
  coords: Float32Array.from({ length: n * 2 }, (_, i) => (i % 2 === 0 ? x + i / 2 : 0)),
  fillRule: 'nonzero',
});
const rect = (x: number): Path => ({ kind: 'rect', x, y: 0, width: 10, height: 10 });

function setup(pose: Path) {
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
  const scene = createScene<object, 'main', Path>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', pose, data: {} });
  const adapter = sceneToAdapter(scene) as unknown as PoseAnimationAdapter<Path>;
  const shown = () => effectivePose(scene, scene.get(a)!);
  /** The first x of the pose on screen. */
  const x = (): number => { const p = shown(); return p.kind === 'rect' ? p.x : p.coords[0]!; };
  return { animator: result.current, frame, scene, a, adapter, shown, x };
}

describe('tweenPose on a path pose', () => {
  it('moves a polygon on its pose target, where a second move adds to the first', () => {
    const { animator, frame, scene, a, adapter, shown, x } = setup(poly(0));
    act(() => { tweenPose(animator, adapter, { id: a, to: poly(100), ms: 100, easing: linear, recordOp: false }); });
    expect(adapter.poseTarget?.(a)?.active).toBe(true);
    expect((scene.get(a)!.pose as { coords: Float32Array }).coords[0]).toBe(100);
    frame(0);
    frame(50);
    expect(x()).toBeCloseTo(50, 3);
    act(() => { tweenPose(animator, adapter, { id: a, to: poly(200), ms: 100, easing: linear, recordOp: false }); });
    frame(100);
    // The first has arrived at 100; the second is halfway through its own 100.
    expect(x()).toBeCloseTo(150, 3);
    const p = shown();
    expect(p.kind).toBe('polygon');
    expect(Array.from((p as { coords: Float32Array }).coords)).toEqual([150, 0, 151, 0, 152, 0].map((n) => expect.closeTo(n, 3)));
    expect((p as { commands: Uint8Array }).commands).toEqual((poly(0) as { commands: Uint8Array }).commands);
    frame(150);
    frame(166);
    expect(x()).toBe(200);
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('moves a rect path on its pose target', () => {
    const { animator, frame, a, adapter, shown } = setup(rect(0));
    act(() => { tweenPose(animator, adapter, { id: a, to: rect(100), ms: 100, easing: linear, recordOp: false }); });
    frame(0);
    frame(50);
    expect(shown()).toEqual({ kind: 'rect', x: 50, y: 0, width: 10, height: 10 });
  });

  it('moves a polygon whose point count changed since it last moved', () => {
    const { animator, frame, scene, a, adapter, x } = setup(poly(0));
    act(() => { tweenPose(animator, adapter, { id: a, to: poly(100), ms: 100, easing: linear, recordOp: false }); });
    frame(0);
    frame(100);
    frame(116);
    scene.setPose(a, poly(0, 5));
    act(() => { tweenPose(animator, adapter, { id: a, to: poly(100, 5), ms: 100, easing: linear, recordOp: false }); });
    frame(116);
    frame(166);
    expect(x()).toBeCloseTo(50, 3);
  });
});
