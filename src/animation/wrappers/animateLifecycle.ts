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

export function animateLifecycle<TObject extends { id: string; pose?: TPose }, TPose>(
  adapter: SceneAdapter<TObject, TPose>,
  animator: Animator,
  opts: LifecycleAnimation<TPose>,
): SceneAdapter<TObject, TPose> {
  const ms = opts.ms ?? 200;

  return {
    ...adapter,
    insertObject(object: TObject): void {
      adapter.insertObject(object);
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
    removeObject(id: string): void {
      if (!opts.exitTo) {
        adapter.removeObject(id);
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
        onDone: () => adapter.removeObject(id),
      });
    },
  };
}
