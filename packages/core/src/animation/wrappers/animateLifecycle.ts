import { tweenPose } from '../poseHelpers';
import type { PoseProjection } from 'interactions/actions/resize/geometry';
import type { SceneAdapter } from 'core/adapters/types';
import type { Animator, EasingSpec } from '../types';

/** How nodes enter and leave. `enterFrom` derives the pose a new node starts
 *  at, given where it belongs; `exitTo` derives the pose a departing node
 *  animates to before it is actually removed. Omit either to leave that
 *  transition instant. */
export interface LifecycleAnimation<TPose> {
  /** Pose to animate the new object FROM at insert. */
  enterFrom?: (final: TPose) => TPose;
  /** Pose to animate the existing object TO at remove. */
  exitTo?: (current: TPose) => TPose;
  ms?: number;
  easing?: EasingSpec;
  geometry?: PoseProjection<TPose>;
}

/** Wrap an adapter so inserts and removals animate — the scene-graph
 *  equivalent of CSS enter/leave transitions. */
export function animateLifecycle<TNode extends { id: string; pose?: TPose }, TPose>(
  adapter: SceneAdapter<TNode, TPose>,
  animator: Animator,
  opts: LifecycleAnimation<TPose>,
): SceneAdapter<TNode, TPose> {
  const ms = opts.ms ?? 200;

  return {
    ...adapter,
    insertNode(object: TNode, index?: number): void {
      adapter.insertNode(object, index);
      if (!opts.enterFrom) return;
      const final = adapter.getPose(object.id);
      const start = opts.enterFrom(final);
      adapter.setPose(object.id, start);
      tweenPose(animator, adapter as never, {
        id: object.id,
        to: final,
        ms,
        easing: opts.easing,
        geometry: opts.geometry,
        recordOp: false,
      });
    },
    removeNode(id: string): void {
      if (!opts.exitTo) {
        adapter.removeNode(id);
        return;
      }
      const current = adapter.getPose(id);
      tweenPose(animator, adapter as never, {
        id,
        to: opts.exitTo(current),
        ms,
        easing: opts.easing,
        geometry: opts.geometry,
        recordOp: false,
        onDone: () => adapter.removeNode(id),
      });
    },
  };
}
