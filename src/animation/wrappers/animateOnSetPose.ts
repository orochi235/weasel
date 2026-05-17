import { tweenPose, springPose } from '../poseHelpers';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { SceneAdapter } from 'core/adapters/types';
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

export function animateOnSetPose<TNode extends { id: string }, TPose>(
  adapter: SceneAdapter<TNode, TPose>,
  animator: Animator,
  opts: AnimateOnSetPoseOptions<TPose> = {},
): SceneAdapter<TNode, TPose> {
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
      // Re-entrant short-circuit (a): the caller IS another animation's tick
      // (momentum decay, in-flight tween, spring) writing setPose ~60×/sec.
      // Wrapping each call in a fresh 250ms tween fights the caller — the
      // new tween's t=0 sample writes back the previous `from`, undoing
      // this onTick — and when each wrap-tween settles, the very next
      // caller-tick spawns another, looping visibly forever (cards never
      // stop after a flick). Detect via animator.isTicking() and write
      // through.
      if (animator.isTicking()) {
        adapter.setPose(id, pose);
        return;
      }
      // Re-entrant short-circuit (b): a prior wrap-tween for this id is
      // still in flight. Let it finish rather than registering a competing
      // tween. (Earlier guard from 3af4ed8; kept alongside (a) for the case
      // where setPose is called from outside the animator's own tick loop
      // but a pose:<id> tween is still mid-transition.)
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
