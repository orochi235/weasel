import { tweenPose, springPose } from '../poseHelpers';
import type { PoseDescriptor } from '../../interactions/gestures/resize/geometry';
import type { SceneAdapter } from '../../core/adapters/types';
import type { Animator, EasingFn, SpringPresetName } from '../types';

export interface AnimateOnSetPoseOptions<TPose> {
  /** Default: 200ms tween with easeOut. */
  ms?: number;
  easing?: EasingFn;
  /** Use a spring instead of a duration tween. Mutually exclusive with ms/easing. */
  spring?: {
    preset?: SpringPresetName;
    stiffness?: number;
    damping?: number;
    mass?: number;
  };
  geometry?: PoseDescriptor<TPose>;
  /** Predicate: return false to skip animation and write through immediately. */
  shouldAnimate?: (id: string, from: TPose, to: TPose) => boolean;
  /** Convenience: when true, auto-skip animation if the id is currently being
   *  manipulated by an active gesture. Implementation: see `gestureScope` —
   *  the wrapper consults a shared "in-flight ids" Set if one is provided,
   *  otherwise this option is a no-op (treat as `shouldAnimate` returning true).
   *  Mutually exclusive with `shouldAnimate`. */
  skipDuringGesture?: boolean;
  /** Optional: a Set the kit (or app) populates with ids currently being
   *  manipulated by a gesture. When `skipDuringGesture` is true and the id
   *  is in this Set, the wrapper writes through immediately. */
  gestureScope?: ReadonlySet<string>;
  /** Op label for the recorded transform op. Default: `'animate'`. */
  opLabel?: string;
}

export function animateOnSetPose<TObject extends { id: string }, TPose>(
  adapter: SceneAdapter<TObject, TPose>,
  animator: Animator,
  opts: AnimateOnSetPoseOptions<TPose> = {},
): SceneAdapter<TObject, TPose> {
  const ms = opts.ms ?? 200;
  const skipPredicate = (id: string, from: TPose, to: TPose): boolean => {
    if (opts.shouldAnimate) return !opts.shouldAnimate(id, from, to);
    if (opts.skipDuringGesture && opts.gestureScope?.has(id)) return true;
    return false;
  };

  return {
    ...adapter,
    setPose(id: string, pose: TPose): void {
      const from = adapter.getPose(id);
      if (skipPredicate(id, from, pose)) {
        adapter.setPose(id, pose);
        return;
      }
      // Re-entrant short-circuit: when a higher-frequency animation (e.g.
      // momentum decay) calls setPose every rAF tick, we'd otherwise spawn a
      // brand-new 250ms tween every frame, each immediately cancelled by the
      // next. That stackup synchronously registers ~60 tweens/sec inside the
      // animator's own tick loop, which (a) writes back the previous `from`
      // value at every wrap-tween's t=0 sample, undoing the decay's effect,
      // and (b) under heavy interaction overwhelms the renderer process.
      // If the existing target for this id matches the requested pose
      // closely (typical when the caller is itself an animation), write
      // through directly so the in-flight tween keeps owning the id.
      if (animator.isActive('pose:' + id)) {
        adapter.setPose(id, pose);
        return;
      }
      if (opts.spring) {
        springPose(animator, adapter as never, {
          id,
          to: pose,
          preset: opts.spring.preset,
          stiffness: opts.spring.stiffness,
          damping: opts.spring.damping,
          mass: opts.spring.mass,
          geometry: opts.geometry,
          opLabel: opts.opLabel,
        });
      } else {
        tweenPose(animator, adapter as never, {
          id,
          to: pose,
          ms,
          easing: opts.easing,
          geometry: opts.geometry,
          opLabel: opts.opLabel,
        });
      }
    },
  };
}
