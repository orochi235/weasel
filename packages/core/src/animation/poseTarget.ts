import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../core/geometry/poseDescriptor';
import { documentPose, type PoseSource } from '../core/scene/effectivePose';
import type { NodeId, PoseOverride, PoseOverrides } from '../core/scene/types';
import { axesOf } from './engine/axes';
import { createTarget, type Target, type TargetAxes } from './target';

/** What {@link createPoseTarget} takes. */
export interface PoseTargetOptions<TPose> {
  /** The node whose pose it is. */
  id: string;
  /** The node's committed pose: where the document says it is. */
  get(): TPose;
  /** Commits a pose: an animation's destination as it starts, and where a canceled one stopped. */
  set(pose: TPose): void;
  /** Where the pose on screen is published while the node moves. */
  overrides: PoseOverrides<TPose>;
  /** Supplies the pose's axes through `PoseDescriptor.axes`. Without one, or where it answers
   *  null, the pose has to be a number, an array of numbers, or an object of numeric fields. */
  descriptor?: PoseDescriptor<TPose>;
}

/** The part of a scene {@link scenePoseTarget} reads and writes. A `Scene` satisfies it. */
export interface PoseTargetScene<TPose> extends PoseSource<TPose> {
  readonly overrides: PoseOverrides<TPose>;
  setPose(id: NodeId, pose: TPose): void;
  untracked<T>(fn: () => T): T;
}

/** How `like`'s kind of pose maps to axes: the descriptor's own mapping, else its flat numeric
 *  fields. Null for a pose with neither. */
export function poseAxes<TPose>(
  descriptor: PoseDescriptor<TPose> | undefined,
  like: TPose,
): TargetAxes<TPose> | null {
  return descriptor?.axes?.(like) ?? (axesOf(like) as TargetAxes<TPose> | null);
}

const publishers = new WeakMap<object, () => void>();

/** One function per overrides table, so every target publishing into it shares one commit a frame. */
function publisherOf<TPose>(overrides: PoseOverrides<TPose>): () => void {
  let publish = publishers.get(overrides);
  if (!publish) {
    publish = () => overrides.commit();
    publishers.set(overrides, publish);
  }
  return publish;
}

function build<TPose>(opts: PoseTargetOptions<TPose>, onRest?: () => void): Target<TPose> | null {
  const { overrides, descriptor } = opts;
  const id = opts.id as NodeId;
  let like = opts.get();
  let axes = poseAxes(descriptor, like);
  if (!axes) return null;
  const { count } = axes;
  // Fields the axes leave alone come from the committed pose as it is now, not as it was when
  // the target was made, or a canceled animation would commit them stale.
  const current = (): TargetAxes<TPose> => {
    const now = opts.get();
    if (now !== like) {
      const next = poseAxes(descriptor, now);
      if (next && next.count === count) axes = next;
      like = now;
    }
    return axes!;
  };
  const entry: PoseOverride<TPose> = {};
  let installed = false;
  const target = createTarget<TPose>({
    get: opts.get,
    set: opts.set,
    axes: { count, angles: axes.angles, to: (p) => current().to(p), from: (a) => current().from(a) },
    show(pose) {
      if (target.active) {
        entry.pose = pose;
        // Installed once per run: an override laid over it since, a drag's, is not taken back.
        if (!installed) overrides.set(id, entry);
        installed = true;
        return;
      }
      installed = false;
      if (overrides.get(id) === entry) overrides.clear(id);
      onRest?.();
    },
    publish: publisherOf(overrides),
  });
  return target;
}

/**
 * A {@link Target} over one node's pose. Animations on it commit their destination through
 * `set` as they start, and the pose on screen reaches the paint and pick walks as a pose
 * override: installed while the node moves and cleared when it comes to rest.
 *
 * Throws for a pose with no axes. Make one per node: two targets over one node do not add.
 * {@link scenePoseTarget} keeps that one for a scene's nodes.
 */
export function createPoseTarget<TPose>(opts: PoseTargetOptions<TPose>): Target<TPose> {
  const target = build(opts);
  if (!target) {
    throw new Error('createPoseTarget: this pose has no axes; give a descriptor whose `axes` maps it');
  }
  return target;
}

const sceneTargets = new WeakMap<object, Map<string, Target<unknown>>>();

function samePose(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length
    && ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

/**
 * The pose target of node `id` in `scene`: the same one on every call, so everything animating
 * the node adds. Its committed value is the node's document pose, written without recording;
 * a caller that wants the move in history records its own op first.
 *
 * Undefined for a node that is not in the scene, or whose pose has no axes. `descriptor`
 * defaults to `RECT_POSE_DESCRIPTOR` and is read the first time a node's target is made.
 */
export function scenePoseTarget<TPose>(
  scene: PoseTargetScene<TPose>,
  id: string,
  descriptor?: PoseDescriptor<TPose>,
): Target<TPose> | undefined {
  let made = sceneTargets.get(scene.overrides);
  if (!made) {
    made = new Map();
    sceneTargets.set(scene.overrides, made);
  }
  const held = made.get(id) as Target<TPose> | undefined;
  if (held) return held;
  const nid = id as NodeId;
  const node = scene.get(nid);
  if (!node) return undefined;
  // A node removed mid-flight keeps answering with the last pose it had.
  let last = documentPose(scene, node);
  const cache = made;
  const target = build<TPose>({
    id,
    descriptor: descriptor ?? (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>),
    overrides: scene.overrides,
    get() {
      const n = scene.get(nid);
      if (n) last = documentPose(scene, n);
      return last;
    },
    set(pose) {
      const n = scene.get(nid);
      if (!n || samePose(n.pose, pose)) return;
      scene.untracked(() => scene.setPose(nid, pose));
    },
  }, () => {
    if (!scene.get(nid)) cache.delete(id);
  });
  if (!target) return undefined;
  made.set(id, target as Target<unknown>);
  return target;
}
