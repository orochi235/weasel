import { createTransformOp } from 'core/ops/transform';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { Op } from 'core/ops/types';
import type {
  AnimationHandle, Animator, EasingSpec, SpringPresetName, StaggerDelay, StaggerOptions,
} from './types';
import type { Target } from './target';

/** The part of an adapter `tweenPose` and `springPose` use. Any `SceneAdapter` is one, and so is
 *  the adapter `sceneToAdapter` and `useSceneAdapter` build. */
export interface PoseAnimationAdapter<TPose> {
  getPose(id: string): TPose;
  setPose(id: string, pose: TPose): void;
  applyOps?(ops: Op[], label: string): void;
  /** See `SceneAdapter.poseTarget`. */
  poseTarget?(id: string, descriptor?: PoseDescriptor<TPose>): Target<TPose> | undefined;
}

/** Options for `tweenPose`. */
export interface TweenPoseOptions<TPose> {
  id: string;
  to: TPose;
  /** Where the move appears to start. Default: where the node is. Nothing is written there. */
  from?: TPose;
  ms: number;
  easing?: EasingSpec;
  /** Supplies the pose's axes, and its `lerp` is the path the move follows. Without one the
   *  adapter's own descriptor maps the pose and each axis travels in a straight line. */
  geometry?: PoseDescriptor<TPose>;
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
  geometry?: PoseDescriptor<TPose>;
  recordOp?: boolean;
  opLabel?: string;
  onDone?: () => void;
}

/** The cancel key every move of node `id`'s pose shares. */
export const poseKey = (id: string): string => `pose:${id}`;

function recordTransformOp<TPose>(
  adapter: PoseAnimationAdapter<TPose>,
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
 * Animate one node's pose to `to` over `ms`.
 *
 * On an adapter with `poseTarget`, the destination is committed as the move starts. A
 * scene-backed adapter shows the travel through the scene's pose overrides, so the document
 * holds `to` throughout and nothing is written per frame; an `arrayAdapter` is written the
 * pose on screen each frame and `to` as the move ends. Moves on one node add: a
 * second `tweenPose` bends the first toward its own destination and cancels nothing. They share
 * the key `pose:<id>` for `cancelKey`, `pauseKey`, and `isActive`.
 *
 * By default one transform op covering the whole move is recorded up front, so one undo
 * returns the node to where it started. Undone mid-flight, the node comes to rest on the
 * undone pose.
 *
 * An adapter without `poseTarget`, and a pose its descriptor gives no axes for, keep the older
 * behavior: `setPose` is written each frame, and a new move on the node cancels the one running.
 */
export function tweenPose<TPose>(
  animator: Animator,
  adapter: PoseAnimationAdapter<TPose>,
  opts: TweenPoseOptions<TPose>,
): AnimationHandle {
  const recordOp = opts.recordOp ?? true;
  const label = opts.opLabel ?? 'animate';
  const cancelKey = poseKey(opts.id);
  const target = adapter.poseTarget?.(opts.id, opts.geometry);
  if (target) {
    const committed = target.committed();
    if (recordOp) recordTransformOp(adapter, opts.id, committed, opts.to, label);
    const lerp = opts.geometry?.lerp;
    return animator.tween<TPose>({
      target,
      from: opts.from ?? committed,
      to: opts.to,
      ms: opts.ms,
      easing: opts.easing,
      cancelKey,
      interrupt: false,
      interpolate: lerp && ((a, b, t) => lerp(a, b, t)),
      onDone: opts.onDone,
    });
  }
  const geometry = (opts.geometry ?? (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>));
  if (!geometry.lerp) {
    throw new Error('tweenPose: geometry has no lerp; supply geometry: { ..., lerp }');
  }
  const lerp = geometry.lerp;
  const from = adapter.getPose(opts.id);
  if (recordOp) recordTransformOp(adapter, opts.id, from, opts.to, label);
  return animator.tween<TPose>({
    from: opts.from ?? from,
    to: opts.to,
    ms: opts.ms,
    easing: opts.easing,
    cancelKey,
    interpolate: (a, b, t) => lerp(a, b, t),
    onTick: (value) => adapter.setPose(opts.id, value),
    onDone: opts.onDone,
  });
}

/**
 * `tweenPose` driven by a spring instead of a duration, with the same op recording.
 *
 * On an adapter with `poseTarget` it interrupts every move under `pose:<id>` and starts at
 * their velocity, from the pose on screen. Otherwise it falls back as `tweenPose` does.
 */
export function springPose<TPose>(
  animator: Animator,
  adapter: PoseAnimationAdapter<TPose>,
  opts: SpringPoseOptions<TPose>,
): AnimationHandle {
  const recordOp = opts.recordOp ?? true;
  const label = opts.opLabel ?? 'animate';
  const cancelKey = poseKey(opts.id);
  const target = adapter.poseTarget?.(opts.id, opts.geometry);
  if (target) {
    // Read ahead of the op: the spring starts from the pose on screen, wherever that commit
    // and the interrupted moves leave the committed one.
    const shown = target.read();
    if (recordOp) recordTransformOp(adapter, opts.id, target.committed(), opts.to, label);
    return animator.spring<TPose>({
      target,
      from: shown,
      to: opts.to,
      preset: opts.preset,
      stiffness: opts.stiffness,
      damping: opts.damping,
      mass: opts.mass,
      cancelKey,
      onDone: opts.onDone,
    });
  }
  const geometry = (opts.geometry ?? (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>));
  if (!geometry.lerp) {
    throw new Error('springPose: geometry has no lerp; supply geometry: { ..., lerp }');
  }
  const lerp = geometry.lerp;
  const from = adapter.getPose(opts.id);
  if (recordOp) recordTransformOp(adapter, opts.id, from, opts.to, label);
  // The spring integrates progress from 0 to 1, and lerp makes the pose from it.
  return animator.spring<number>({
    from: 0,
    to: 1,
    preset: opts.preset,
    stiffness: opts.stiffness,
    damping: opts.damping,
    mass: opts.mass,
    cancelKey,
    interpolate: (a, b, t) => a + (b - a) * t,
    onTick: (progress) => adapter.setPose(opts.id, lerp(from, opts.to, progress)),
    onDone: opts.onDone,
  });
}

/** Options for `staggerSpringPose`: the items and their delays, each item's destination, and
 *  the spring tuning. `cancelKey` and `label` belong to the stagger as a whole; each item's
 *  spring keeps its own `pose:<id>` key. */
export interface StaggerSpringPoseOptions<TItem, TPose> extends StaggerOptions {
  /** Each is a node id, or carries one in a string `id` field. */
  items: readonly TItem[];
  delay: StaggerDelay;
  to: (item: TItem, index: number) => TPose;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  geometry?: PoseDescriptor<TPose>;
  recordOp?: boolean;
  opLabel?: string;
}

function itemId(item: unknown): string {
  if (item != null && typeof item === 'object' && 'id' in item) {
    const id = (item as { id: unknown }).id;
    if (typeof id === 'string') return id;
  }
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  throw new Error(
    'staggerSpringPose: each item must either be a primitive (string/number) ' +
      'or have a string `id` field. Otherwise pose ids would collide.',
  );
}

/** `springPose` for each of `items`, started `delay` apart as `animator.stagger` counts it. */
export function staggerSpringPose<TItem, TPose>(
  animator: Animator,
  adapter: PoseAnimationAdapter<TPose>,
  opts: StaggerSpringPoseOptions<TItem, TPose>,
): AnimationHandle {
  return animator.stagger(opts.items, opts.delay).each(
    (item, i) =>
      springPose(animator, adapter, {
        id: itemId(item),
        to: opts.to(item, i),
        preset: opts.preset,
        stiffness: opts.stiffness,
        damping: opts.damping,
        mass: opts.mass,
        geometry: opts.geometry,
        recordOp: opts.recordOp,
        opLabel: opts.opLabel,
      }),
    { cancelKey: opts.cancelKey, label: opts.label },
  );
}
