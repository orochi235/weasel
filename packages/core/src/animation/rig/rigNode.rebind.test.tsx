import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { linear, type Path } from '@weasel-js/geom';
import { type Animator, type Skeleton, type Skin } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import { createScene } from '../../core/scene/scene';
import type { RectPose } from '../../core/scene/types';
import type { Rig } from './bindRig';
import { useRigNode } from './rigNode';

type Data = { skeleton?: Skeleton; skin?: Skin; joint?: string; path?: Path };

const ARM: Skeleton = {
  joints: [
    { name: 'upper', parent: null, bind: { x: 0, y: 50, rotation: 0, scaleX: 1, scaleY: 1 } },
    { name: 'lower', parent: 'upper', bind: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
  ],
};
const BOX: RectPose = { x: 100, y: 50, width: 100, height: 100 };

/** A rig node with one skinned sleeve, a mounted `useRigNode`, and an animator the test steps. */
function mounted() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const node = scene.add({ kind: 'container', layer: 'main', pose: BOX, data: { skeleton: ARM } });
  const sleeve = scene.add({
    kind: 'leaf', layer: 'main', parent: node, pose: { x: 100, y: 95, width: 100, height: 10 },
    data: { path: { kind: 'rect', x: 100, y: 95, width: 100, height: 10 }, skin: { upper: [1, 0, 0, 1], lower: [0, 1, 1, 0] } },
  });
  let now = 0;
  const cbs: ((t: number) => void)[] = [];
  const rigs: Rig[] = [];
  let animator!: Animator;
  function Probe() {
    animator = useAnimator({
      now: () => now,
      requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
      cancelFrame: () => {},
    });
    rigs.push(useRigNode({ scene, node }));
    return null;
  }
  render(<Probe />);
  return {
    scene, node, sleeve, rigs,
    animator,
    rig: () => rigs[rigs.length - 1],
    step: (ms: number) => act(() => { now += ms; for (const cb of cbs.splice(0)) cb(now); }),
    /** How far the lower joint has turned on screen. */
    turn: () => {
      const m = rigs[rigs.length - 1].world().get('lower')!;
      return Math.atan2(m[1], m[0]);
    },
    /** Put a root joint ahead of the arm's, which moves every axis the arm had. */
    rejoint: () => act(() => {
      scene.update(node, {
        data: { skeleton: { joints: [{ name: 'base', parent: null, bind: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }, ...ARM.joints] } },
      });
    }),
    reweigh: () => act(() => {
      scene.update(sleeve, { data: { ...scene.get(sleeve)!.data, skin: { upper: [1, 1, 0, 1], lower: [0, 0, 1, 0] } } });
    }),
  };
}

describe('useRigNode binding again', () => {
  it('goes on with an animation running on its target', () => {
    const { rigs, rig, animator, step, turn, reweigh, scene, sleeve } = mounted();
    act(() => { animator.tween({ target: rig().target, to: { lower: { rotation: 1 } }, ms: 100, easing: linear }); });
    step(0);
    step(50);
    expect(turn()).toBeCloseTo(0.5, 6);

    reweigh();
    expect(rig()).not.toBe(rigs[0]);
    expect(rig().target).toBe(rigs[0].target);
    // Shown as it binds, not left at rest until the next frame.
    expect(scene.overrides.read(sleeve)?.path).toBeDefined();
    expect(turn()).toBeCloseTo(0.5, 6);

    step(25);
    expect(turn()).toBeCloseTo(0.75, 6);
    step(25);
    expect(turn()).toBeCloseTo(1, 6);
  });

  it('keeps the pose it was given', () => {
    const { rig, turn, reweigh } = mounted();
    rig().pose({ lower: { rotation: 0.3 } });
    reweigh();
    expect(rig().target.read()).toEqual({ lower: { rotation: 0.3 } });
    expect(turn()).toBeCloseTo(0.3, 6);
  });

  it('stays at rest when it was released before binding again', () => {
    const { rig, reweigh, scene, sleeve } = mounted();
    rig().pose({ lower: { rotation: 0.3 } });
    rig().release();
    reweigh();
    expect(scene.overrides.read(sleeve)).toBeUndefined();
  });

  it('makes a new target when the joints change', () => {
    const { rigs, rig, rejoint } = mounted();
    rejoint();
    expect(rig().target).not.toBe(rigs[0].target);
    expect(rig().target.axisCount).toBe(15);
  });

  it('goes on showing an animation that was running as the joints changed', () => {
    const { rigs, rig, animator, step, turn, rejoint } = mounted();
    act(() => { animator.tween({ target: rig().target, to: { lower: { rotation: 1 } }, ms: 100, easing: linear }); });
    step(0);
    step(50);
    expect(turn()).toBeCloseTo(0.5, 6);

    rejoint();
    expect(turn()).toBeCloseTo(0.5, 6);
    step(25);
    expect(turn()).toBeCloseTo(0.75, 6);
    step(25);
    expect(turn()).toBeCloseTo(1, 6);
    step(16);
    expect(rigs[0].target.active).toBe(false);
    expect(rig().target.read().lower?.rotation).toBeCloseTo(1, 6);
    expect(rig().target.committed().lower?.rotation).toBeCloseTo(1, 6);
  });

  it('adds an animation started after the change to the one still running from before', () => {
    const { rig, animator, step, turn, rejoint } = mounted();
    act(() => { animator.tween({ target: rig().target, to: { lower: { rotation: 1 } }, ms: 100, easing: linear }); });
    step(0);
    step(50);
    rejoint();
    act(() => { animator.tween({ target: rig().target, to: { lower: { rotation: 2 } }, ms: 100, easing: linear }); });
    step(0);
    expect(turn()).toBeCloseTo(0.5, 6);
    step(100);
    expect(turn()).toBeCloseTo(2.5, 6);
  });

  it('keeps the pose it was given through a change of joints', () => {
    const { rig, turn, rejoint } = mounted();
    rig().pose({ lower: { rotation: 0.3 }, upper: { x: 4 } });
    rejoint();
    expect(rig().target.read()).toEqual({ lower: { rotation: 0.3 }, upper: { x: 4 } });
    expect(turn()).toBeCloseTo(0.3, 6);
  });

  it('leaves out the pose of a joint the skeleton no longer has', () => {
    const { rig, scene, node, sleeve } = mounted();
    rig().pose({ lower: { rotation: 0.3 }, upper: { x: 4 } });
    act(() => {
      scene.update(sleeve, { data: { path: { kind: 'rect', x: 100, y: 95, width: 100, height: 10 } } });
      scene.update(node, { data: { skeleton: { joints: [ARM.joints[0], { ...ARM.joints[1], name: 'fore' }] } } });
    });
    expect(rig().target.read()).toEqual({ upper: { x: 4 } });
  });
});
