import { RECT_POSE_DESCRIPTOR } from '@weasel-js/core';
import type { NodeId, PoseDescriptor, Scene } from '@weasel-js/core';
import type { Animator } from '@weasel-js/animator';
import { transitionCancelKey } from './cancelKey';
import { interruptNode } from './liveTransitions';
import { createTransition } from './transition';
import type { D3Selection } from './types';

/** @internal */
export function createSelection<TData, TPose>(
  scene: Scene<unknown, string, TPose>,
  ids: readonly NodeId[],
  data: readonly TData[],
  priorPoses: ReadonlyMap<NodeId, TPose>,
  animator: Animator | undefined,
  geometry: PoseDescriptor<TPose> | undefined,
  incarnations: ReadonlyMap<NodeId, number | undefined> = new Map(
    ids.map((id) => [id, scene.incarnation(id)]),
  ),
): D3Selection<TData, TPose> {
  const sel: D3Selection<TData, TPose> = {
    ids,
    data,
    filter(pred) {
      const subset: NodeId[] = [];
      const subData: TData[] = [];
      for (let i = 0; i < data.length; i++) {
        if (pred(data[i], i)) {
          subset.push(ids[i]);
          subData.push(data[i]);
        }
      }
      return createSelection(
        scene, subset, subData, priorPoses, animator, geometry, incarnations,
      );
    },
    each(fn) {
      for (let i = 0; i < ids.length; i++) fn(data[i], ids[i], i);
      return sel;
    },
    transition(name?: string) {
      if (!animator) {
        throw new Error(
          'd3Bind.transition: pass `animator` in D3BindOptions to enable transitions',
        );
      }
      const resolvedGeometry = (geometry ??
        (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>));
      return createTransition({
        scene,
        animator,
        geometry: resolvedGeometry,
        ids,
        data,
        priorPoses,
        incarnations,
        name: name ?? '',
      });
    },
    interrupt(name?: string) {
      if (!animator) return sel;
      for (const id of ids) interruptNode(animator, transitionCancelKey(name ?? '', id));
      return sel;
    },
  };
  return sel;
}
