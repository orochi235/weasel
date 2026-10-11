import { act, renderHook } from '@testing-library/react';
import { createScene } from '../../core/scene/scene';
import { effectivePose } from '../../core/scene/effectivePose';
import type { NodeId, RectPose } from '../../core/scene/types';
import { mat3 } from '../../renderer/math/mat3';
import { useAnimator } from '../useAnimator';
import { bindRig } from './bindRig';
import type { Skeleton } from './types';

/** A two-bone arm: shoulder at (100, 100) pointing +x, elbow 50 along it. */
export const ARM: Skeleton = {
  joints: [
    { name: 'upper', parent: null, bind: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 } },
    { name: 'lower', parent: 'upper', bind: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
  ],
};

/** The arm bound to two bone rects, and an animator whose frames the test steps. */
export function rigged() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' as const }] });
  const upper = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 95, width: 50, height: 10 }, data: {} });
  const lower = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 150, y: 95, width: 50, height: 10 }, data: {} });
  const rig = bindRig({ scene, skeleton: ARM, bindings: { upper, lower } });

  let now = 0;
  const cbs: ((t: number) => void)[] = [];
  const { result } = renderHook(() => useAnimator({
    now: () => now,
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
  }));
  const where = (id: NodeId): RectPose => effectivePose(scene, scene.get(id)!);
  return {
    scene, upper, lower, rig,
    animator: result.current,
    /** Runs one frame `ms` after the last. */
    step: (ms: number) => act(() => { now += ms; for (const cb of cbs.splice(0)) cb(now); }),
    where,
    /** The upper bone's rotation on screen: the `upper` joint's, since it is the root. */
    turn: () => where(upper).rotation ?? 0,
    /** How far joint `name` sits along x from where the bind pose puts it. */
    shift: (name: 'upper' | 'lower' = 'upper') =>
      mat3.apply(rig.world().get(name)!, 0, 0)[0] - (name === 'upper' ? 100 : 150),
  };
}
