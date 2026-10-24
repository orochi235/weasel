import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../core/geometry/poseDescriptor';
import { documentPose, type PoseSource } from '../core/scene/effectivePose';
import type { NodeId, PoseOverride, PoseOverrides } from '../core/scene/types';
import { axesOf } from '@weasel-js/animator';
import { createTarget, type Target, type TargetAxes } from '@weasel-js/animator';

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

/**
 * `poseAxes` for the pose `get` answers, with `from` keeping the fields that are not axes as
 * that pose has them now. Reading them once would leave them stale in every pose a canceled
 * animation commits. Null where the pose has no axes.
 */
export function liveAxes<TPose>(
  descriptor: PoseDescriptor<TPose> | undefined,
  get: () => TPose,
): TargetAxes<TPose> | null {
  let like = get();
  let axes = poseAxes(descriptor, like);
  if (!axes) return null;
  const { count, angles } = axes;
  const current = (): TargetAxes<TPose> => {
    const now = get();
    if (now !== like) {
      const next = poseAxes(descriptor, now);
      if (next && next.count === count) axes = next;
      like = now;
    }
    return axes!;
  };
  return {
    count,
    angles,
    to: (p) => current().to(p),
    from: (a) => current().from(a),
    add: axes.add && ((p, d) => {
      const now = current();
      if (now.add) return now.add(p, d);
      return now.from(now.to(p).map((n, i) => n + d[i]!));
    }),
    write: axes.write && ((p, out, at) => {
      const now = current();
      if (now.write) now.write(p, out, at);
      else now.to(p).forEach((n, i) => { out[at + i] = n; });
    }),
  };
}

/** How a container's pose target carries its descendants, for {@link scenePoseTarget}. */
export interface PoseCascade<TPose> {
  /** Commits `pose` to the container, moving its descendants' poses with it. */
  write(pose: TPose): void;
  /** The descendants, each at the pose to show it at while the container shows at `pose`. */
  beside(pose: TPose): Iterable<readonly [NodeId, TPose]>;
}

/** Shows a moving container's descendants through overrides of their own, and takes them back
 *  as it rests. A descendant something else already overrides is left to it. */
function riders<TPose>(overrides: PoseOverrides<TPose>, cascade: PoseCascade<TPose>): (pose: TPose | null) => void {
  const riding = new Map<NodeId, PoseOverride<TPose>>();
  return (pose) => {
    const seen = new Set<NodeId>();
    for (const [id, beside] of pose === null ? [] : cascade.beside(pose)) {
      let entry = riding.get(id);
      if (!entry) {
        if (overrides.has(id)) continue;
        riding.set(id, entry = {});
        overrides.set(id, entry);
      }
      entry.pose = beside;
      seen.add(id);
    }
    for (const [id, entry] of riding) {
      if (seen.has(id)) continue;
      overrides.clear(id, entry);
      riding.delete(id);
    }
  };
}

function build<TPose>(
  opts: PoseTargetOptions<TPose>,
  onRest?: () => void,
  /** Whether something else has written the committed pose since an animation last did. */
  overwritten?: () => boolean,
  /** Told the pose on screen each time it is shown, and null as the node comes to rest. */
  ride?: (pose: TPose | null) => void,
): Target<TPose> | null {
  const { overrides } = opts;
  const id = opts.id as NodeId;
  const axes = liveAxes(opts.descriptor, opts.get);
  if (!axes) return null;
  const entry: PoseOverride<TPose> = {};
  let installed = false;
  /** While installed, stops the run as soon as the table changes after something else wrote
   *  the pose: a drag laid over the run commits and then lets go, which would show this run's
   *  last frame until its next one. */
  let unwatch: (() => void) | null = null;
  const rest = (): void => {
    installed = false;
    unwatch?.();
    unwatch = null;
    overrides.clear(id, entry);
    ride?.(null);
    onRest?.();
  };
  const target = createTarget<TPose>({
    get: opts.get,
    set: opts.set,
    axes,
    show(pose) {
      // The writer wins: what was left to travel belonged to a pose that is no longer committed.
      if (target.active && overwritten?.()) target.stop({ commit: false });
      if (!target.active) {
        rest();
        return;
      }
      entry.pose = pose;
      // Installed once per run: an override laid over it since, a drag's, is not taken back.
      if (!installed) overrides.set(id, entry);
      installed = true;
      if (overwritten && unwatch === null) {
        unwatch = overrides.subscribe(() => {
          if (!target.active || !overwritten()) return;
          target.stop({ commit: false });
          if (installed) rest();
        });
      }
      ride?.(pose);
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
 * defaults to `RECT_POSE_DESCRIPTOR`. With `cascade`, for a container whose descendants hold
 * poses of their own, a commit goes through `cascade.write` and the descendants are shown
 * traveling beside the container. Both are read the first time a node's target is made.
 */
export function scenePoseTarget<TPose>(
  scene: PoseTargetScene<TPose>,
  id: string,
  descriptor?: PoseDescriptor<TPose>,
  cascade?: PoseCascade<TPose>,
): Target<TPose> | undefined {
  let made = sceneTargets.get(scene.overrides);
  if (!made) {
    made = new Map();
    sceneTargets.set(scene.overrides, made);
  }
  const nid = id as NodeId;
  const node = scene.get(nid);
  const by = descriptor ?? (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>);
  const held = made.get(id) as Target<TPose> | undefined;
  // A pose that has changed shape at rest, a polygon given more points, needs axes made for it.
  const fits = !held || held.active || !node
    || poseAxes(by, documentPose(scene, node))?.count === held.axisCount;
  if (held && fits) return held;
  if (!node) return undefined;
  // A node removed mid-flight keeps answering with the last pose it had.
  let last = documentPose(scene, node);
  /** The node's pose as an animation last left it, or as it was when the first one started. */
  let mine: TPose | undefined;
  const cache = made;
  let target: Target<TPose> | null = null;
  target = build<TPose>({
    id,
    descriptor: by,
    overrides: scene.overrides,
    get() {
      const n = scene.get(nid);
      if (n) last = documentPose(scene, n);
      if (n && !target?.active) mine = n.pose;
      return last;
    },
    set(pose) {
      const n = scene.get(nid);
      if (!n) return;
      if (!samePose(n.pose, pose)) scene.untracked(() => (cascade ? cascade.write(pose) : scene.setPose(nid, pose)));
      mine = scene.get(nid)?.pose;
    },
  }, () => {
    if (!scene.get(nid)) cache.delete(id);
  }, () => {
    const n = scene.get(nid);
    return !!n && mine !== undefined && !samePose(n.pose, mine);
  }, cascade && riders(scene.overrides, cascade));
  if (!target) return undefined;
  made.set(id, target as Target<unknown>);
  return target;
}
