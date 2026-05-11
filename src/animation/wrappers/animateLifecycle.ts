import { tweenPose } from '../poseHelpers';
import type { PoseDescriptor } from 'interactions/gestures/resize/geometry';
import type { SceneAdapter } from 'core/adapters/types';
import type { Animator, EasingFn } from '../types';

export interface LifecycleAnimation<TPose> {
  /** Pose to animate the new object FROM at insert. */
  enterFrom?: (final: TPose) => TPose;
  /** Pose to animate the existing object TO at remove. */
  exitTo?: (current: TPose) => TPose;
  ms?: number;
  easing?: EasingFn;
  geometry?: PoseDescriptor<TPose>;
}

export function animateLifecycle<TNode extends { id: string; pose?: TPose }, TPose>(
  adapter: SceneAdapter<TNode, TPose>,
  animator: Animator,
  opts: LifecycleAnimation<TPose>,
): SceneAdapter<TNode, TPose> {
  const ms = opts.ms ?? 200;

  return {
    ...adapter,
    insertNode(object: TNode): void {
      adapter.insertNode(object);
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
