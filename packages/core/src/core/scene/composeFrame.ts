/** Folding a node's pose up its parent chain to world, and back down. */

/** Minimal adapter needed by `composeWorldPose` and friends — pose lookup plus parent walk. */
export interface PoseAdapter<TPose> {
  getPose(id: string): TPose;
  getParent(id: string): string | null;
  /** Whether `id`'s pose is a frame its children are expressed in. Absent
   *  means every node is one. A container whose pose derives from its children
   *  is not: its children share its frame, so the fold passes over it. */
  definesFrame?(id: string): boolean;
  /** The frame `id` gives its children, from `world`, the frame its own pose
   *  folds to. Absent means `world` itself. A view that scrolls a container's
   *  content answers the frame moved by that offset (`scrolledFrames`); the
   *  document's own readers and writers never carry it. */
  childFrame?(id: string, world: TPose): TPose;
}

/** How far a container's content is scrolled, in the container's own axes:
 *  its children are shown at their stored poses moved by minus this. `z` is
 *  for a pose with a third axis, and a 2D composition ignores it. */
export interface ScrollOffset {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

/**
 * What a container's pose does to its children under a `compose`: nothing,
 * an offset, or a whole frame. `'rigid'` is the frame: a container's rotation
 * and its `transform` both reach its children, and a child's `transform`
 * holds the skew or stretch its box and rotation cannot.
 */
export type PoseClosure = 'identity' | 'translation' | 'rigid';

/** Consumer's pose-composition strategy for hierarchical scenes. `compose`
 *  folds a child's pose (in parent's frame) up to the next frame; `decompose`
 *  is its inverse. A scene's default is `RIGID_POSE_COMPOSITION`. */
export interface PoseComposition<TPose> {
  compose(parent: TPose, child: TPose): TPose;
  decompose(parent: TPose, world: TPose): TPose;
  closure: PoseClosure;
  /** `frame` with its content scrolled by `offset`: the frame a child composed
   *  under it lands where `compose(frame, child)` would put the child moved by
   *  minus `offset` in `frame`'s own axes. Absent, a container's content cannot
   *  be scrolled under this composition. */
  scroll?(frame: TPose, offset: ScrollOffset): TPose;
}

/** The absolute-pose strategy: every node stores its world pose, and a
 *  container groups its children without carrying them — moving it moves
 *  nothing else. For a scene whose poses have no frame to fold, such as one
 *  whose readers take every stored pose as world. */
export const IDENTITY_POSE_COMPOSITION: PoseComposition<never> = {
  compose: (_parent, child) => child,
  decompose: (_parent, world) => world,
  closure: 'identity',
};

/** Whether `composition` makes a container's pose a frame, so a stored pose
 *  is local to it. False for `IDENTITY_POSE_COMPOSITION`. */
export function composesFrames(composition: { closure: PoseClosure }): boolean {
  return composition.closure !== 'identity';
}

/**
 * Walk `id`'s parent chain and fold local poses into a world pose via
 * `compose`. Cycle-safe.
 *
 * `compose(parent, child)` interprets `child` as expressed *in `parent`'s
 * local frame* and returns the equivalent pose in the next frame up.
 */
export function composeWorldPose<TPose>(
  adapter: PoseAdapter<TPose>,
  id: string,
  compose: (parent: TPose, child: TPose) => TPose,
): TPose {
  const chain: string[] = [id];
  const seen = new Set<string>([id]);
  let cursor: string | null = adapter.getParent(id);
  while (cursor !== null) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    if (adapter.definesFrame?.(cursor) ?? true) chain.push(cursor);
    cursor = adapter.getParent(cursor);
  }
  // chain is [id, parent, grandparent, ..., root]; fold from the root down.
  let world = adapter.getPose(chain[chain.length - 1]);
  const childFrame = adapter.childFrame;
  for (let i = chain.length - 2; i >= 0; i--) {
    const frame = childFrame === undefined ? world : childFrame.call(adapter, chain[i + 1], world);
    world = compose(frame, adapter.getPose(chain[i]));
  }
  return world;
}

/** World pose of the frame `id`'s children are expressed in: its own world
 *  pose, through the adapter's `childFrame` when it has one and `id` is a
 *  frame. */
export function composeChildFrame<TPose>(
  adapter: PoseAdapter<TPose>,
  id: string,
  compose: (parent: TPose, child: TPose) => TPose,
): TPose {
  return childFrameAt(adapter, id, composeWorldPose(adapter, id, compose));
}

/** The frame `id` gives its children when its own pose folds to `world`. */
export function childFrameAt<TPose>(adapter: PoseAdapter<TPose>, id: string, world: TPose): TPose {
  if (adapter.childFrame === undefined || !(adapter.definesFrame?.(id) ?? true)) return world;
  return adapter.childFrame(id, world);
}

/**
 * Convert `worldPose` into a local pose expressed under `newParentId`'s
 * frame, so a reparented child keeps its visual world position.
 *
 * `decompose(parent, world)` returns the local pose `child` such that
 * `compose(parent, child) === world`. Pass `newParentId === null` for the
 * root frame; the function returns `worldPose` unchanged.
 */
export function rebaseLocalPose<TPose>(
  adapter: PoseAdapter<TPose>,
  worldPose: TPose,
  newParentId: string | null,
  compose: (parent: TPose, child: TPose) => TPose,
  decompose: (parent: TPose, world: TPose) => TPose,
): TPose {
  const frame = frameAtOrAbove(adapter, newParentId);
  if (frame === null) return worldPose;
  return decompose(composeChildFrame(adapter, frame, compose), worldPose);
}

/** The nearest node at or above `id` whose pose is a frame, or `null` for the
 *  root frame. Cycle-safe, like `composeWorldPose`. */
export function frameAtOrAbove<TPose>(
  adapter: PoseAdapter<TPose>,
  id: string | null,
): string | null {
  const seen = new Set<string>();
  let cursor = id;
  while (cursor !== null && !seen.has(cursor)) {
    if (adapter.definesFrame?.(cursor) ?? true) return cursor;
    seen.add(cursor);
    cursor = adapter.getParent(cursor);
  }
  return null;
}

type Compose = (parent: never, child: never) => unknown;
const memoized = new WeakMap<Compose, Compose>();

/**
 * `compose`, answering the same object for the same parent and child objects,
 * one memo per `compose` however often it is asked for. A paint memo keys on
 * the pose it is handed, and an unchanged child under an unchanged frame must
 * keep its key from one walk to the next.
 */
export function memoizeCompose<TPose>(
  compose: (parent: TPose, child: TPose) => TPose,
): (parent: TPose, child: TPose) => TPose {
  const held = memoized.get(compose as Compose);
  if (held !== undefined) return held as (parent: TPose, child: TPose) => TPose;
  const byParent = new WeakMap<object, WeakMap<object, TPose>>();
  const out = (parent: TPose, child: TPose): TPose => {
    if (typeof parent !== 'object' || parent === null || typeof child !== 'object' || child === null) {
      return compose(parent, child);
    }
    let byChild = byParent.get(parent);
    if (byChild === undefined) byParent.set(parent, byChild = new WeakMap());
    let pose = byChild.get(child);
    if (pose === undefined) byChild.set(child, pose = compose(parent, child));
    return pose;
  };
  memoized.set(compose as Compose, out as Compose);
  return out;
}
