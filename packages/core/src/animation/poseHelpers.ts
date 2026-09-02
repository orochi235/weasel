import { createTransformOp } from 'core/ops/transform';
import { RECT_POSE_DESCRIPTOR, type PoseProjection } from 'interactions/actions/resize/geometry';
import type { SceneAdapter } from 'core/adapters/types';
import type { AnimationHandle, Animator, EasingSpec, SpringPresetName } from './types';

/** Options for `tweenPose`. */
export interface TweenPoseOptions<TPose> {
  id: string;
  to: TPose;
  ms: number;
  easing?: EasingSpec;
  /** Pose descriptor with a `lerp(from, to, t)` method. Defaults to
   *  `RECT_POSE_DESCRIPTOR`, which interpolates x/y/width/height linearly. */
  geometry?: PoseProjection<TPose>;
  /** When true (default), emit a transform op before the tween so undo
   *  restores the pre-animation pose. */
  recordOp?: boolean;
  /** Label for the recorded op. Default: `'animate'`. */
  opLabel?: string;
  onDone?: () => void;
}

/** Options for `springPose`. */
export interface SpringPoseOptions<TPose> {
  id: string;
  to: TPose;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  geometry?: PoseProjection<TPose>;
  recordOp?: boolean;
  opLabel?: string;
  onDone?: () => void;
}

const cancelKeyFor = (id: string): string => `pose:${id}`;

function recordTransformOp<TPose>(
  adapter: SceneAdapter<{ id: string }, TPose>,
  id: string,
  from: TPose,
  to: TPose,
  label: string,
): void {
  if (!adapter.applyOps) return;
  const op = createTransformOp<TPose>({ id, from, to, label });
  adapter.applyOps([op], label);
}

/**
 * Animate one node's pose to `to` over `ms`, writing each frame through the
 * adapter.
 *
 * Unlike the color helpers this really does move the node. Undo therefore has
 * to be considered: by default a single transform op covering the whole
 * animation is recorded up front, so one undo returns the node to where it
 * started rather than replaying frames.
 */
export function tweenPose<TNode extends { id: string }, TPose>(
  animator: Animator,
  adapter: SceneAdapter<TNode, TPose>,
  opts: TweenPoseOptions<TPose>,
): AnimationHandle {
  const geometry = (opts.geometry ?? (RECT_POSE_DESCRIPTOR as unknown as PoseProjection<TPose>));
  if (!geometry.lerp) {
    throw new Error('tweenPose: geometry has no lerp; supply geometry: { ..., lerp }');
  }
  const lerp = geometry.lerp;
  const from = adapter.getPose(opts.id);
  const recordOp = opts.recordOp ?? true;
  const label = opts.opLabel ?? 'animate';
  if (recordOp) recordTransformOp(adapter as never, opts.id, from, opts.to, label);
  return animator.tween<TPose>({
    from,
    to: opts.to,
    ms: opts.ms,
    easing: opts.easing,
    cancelKey: cancelKeyFor(opts.id),
    interpolate: (a, b, t) => lerp(a, b, t),
    onTick: (value) => adapter.setPose(opts.id, value),
    onDone: opts.onDone,
  });
}

/** `tweenPose` driven by a spring instead of a duration. Same op-recording
 *  behavior. */
export function springPose<TNode extends { id: string }, TPose>(
  animator: Animator,
  adapter: SceneAdapter<TNode, TPose>,
  opts: SpringPoseOptions<TPose>,
): AnimationHandle {
  const geometry = (opts.geometry ?? (RECT_POSE_DESCRIPTOR as unknown as PoseProjection<TPose>));
  if (!geometry.lerp) {
    throw new Error('springPose: geometry has no lerp; supply geometry: { ..., lerp }');
  }
  const lerp = geometry.lerp;
  const from = adapter.getPose(opts.id);
  const recordOp = opts.recordOp ?? true;
  const label = opts.opLabel ?? 'animate';
  if (recordOp) recordTransformOp(adapter as never, opts.id, from, opts.to, label);
  // For pose springs: integrate progress (0..1) as the spring's value, then
  // use lerp(from, to, progress) for the actual visual write. This avoids
  // requiring full add/subtract/scale/magnitude on TPose.
  const progressLerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return animator.spring<number>({
    from: 0,
    to: 1,
    preset: opts.preset,
    stiffness: opts.stiffness,
    damping: opts.damping,
    mass: opts.mass,
    cancelKey: cancelKeyFor(opts.id),
    interpolate: progressLerp,
    onTick: (progress) => adapter.setPose(opts.id, lerp(from, opts.to, progress)),
    onDone: opts.onDone,
  });
}
