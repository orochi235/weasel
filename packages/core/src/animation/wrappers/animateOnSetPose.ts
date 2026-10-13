import { poseKey, tweenPose, springPose, type PoseAnimationAdapter } from '../poseHelpers';
import { instantPoseWrite } from './instantPose';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { Animator, EasingSpec, SpringPresetName } from '@weasel-js/animator';

/** Options for `animateOnSetPose`. */
export interface AnimateOnSetPoseOptions<TPose> {
  /** Default: 200ms tween with easeOut. */
  ms?: number;
  easing?: EasingSpec;
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
  /** When true, write through immediately for an id in `gestureScope`. A no-op
   *  without `gestureScope`, and ignored when `shouldAnimate` is set. */
  skipDuringGesture?: boolean;
  /** The ids currently being manipulated by a gesture, for `skipDuringGesture`. */
  gestureScope?: ReadonlySet<string>;
  /** Op label for the recorded transform op. Default: `'animate'`. */
  opLabel?: string;
}

/**
 * Wrap an adapter so every `setPose` animates to the new pose instead of
 * jumping to it. The result is the adapter it was given, with that one method
 * replaced.
 *
 * Poses written from inside another animation's tick, and (optionally) poses
 * written for a node currently under a gesture, are passed straight through.
 *
 * Over a scene-backed adapter the document takes each pose as it is written
 * and only the node on screen glides; an `arrayAdapter` holds the pose on
 * screen, and takes the written one as the glide ends. Writing a node again while it glides
 * bends the glide toward the new pose, or under `spring` carries its velocity
 * into the new one. Over an adapter with no `poseTarget`, a second write ends
 * the glide: the new pose is written at once and stands.
 */
export function animateOnSetPose<TPose, A extends PoseAnimationAdapter<TPose> = PoseAnimationAdapter<TPose>>(
  adapter: A & PoseAnimationAdapter<TPose>,
  animator: Animator,
  opts: AnimateOnSetPoseOptions<TPose> = {},
): A {
  const ms = opts.ms ?? 200;
  const skipPredicate = (id: string, from: TPose, to: TPose): boolean => {
    if (opts.shouldAnimate) return !opts.shouldAnimate(id, from, to);
    if (opts.skipDuringGesture && opts.gestureScope?.has(id)) return true;
    return false;
  };

  return {
    ...adapter,
    ...instantPoseWrite(adapter),
    setPose(id: string, pose: TPose): void {
      const from = adapter.getPose(id);
      if (skipPredicate(id, from, pose)) {
        adapter.setPose(id, pose);
        return;
      }
      // The caller is another animation's tick writing setPose every frame.
      // Wrapping each call in a fresh tween fights it — the new tween's t=0
      // sample writes back the previous `from` — and never settles.
      if (animator.isTicking()) {
        adapter.setPose(id, pose);
        return;
      }
      // Without a pose target a second glide would fight the first, so the write ends it.
      if (!adapter.poseTarget?.(id, opts.geometry) && animator.isActive(poseKey(id))) {
        animator.cancelKey(poseKey(id));
        adapter.setPose(id, pose);
        return;
      }
      if (opts.spring) {
        springPose(animator, adapter, {
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
        tweenPose(animator, adapter, {
          id,
          to: pose,
          ms,
          easing: opts.easing,
          geometry: opts.geometry,
          opLabel: opts.opLabel,
        });
      }
    },
  } as A;
}
