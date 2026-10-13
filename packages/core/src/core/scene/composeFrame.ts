/** Folding a node's pose up its parent chain to world, and back down. */

/** Minimal adapter needed by `composeWorldPose` and friends — pose lookup plus parent walk. */
export interface PoseAdapter<TPose> {
  getPose(id: string): TPose;
  getParent(id: string): string | null;
  /** Whether `id`'s pose is a frame its children are expressed in. Absent
   *  means every node is one. A container whose pose derives from its children
   *  is not: its children share its frame, so the fold passes over it. */
  definesFrame?(id: string): boolean;
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
 *  is its inverse. Default is IDENTITY — an absolute-pose scene where every
 *  node already stores world coords (parent is grouping-only, no transform). */
export interface PoseComposition<TPose> {
  compose(parent: TPose, child: TPose): TPose;
  decompose(parent: TPose, world: TPose): TPose;
  closure: PoseClosure;
}

/** Default pose-composition strategy: IDENTITY, an absolute-pose scene. */
export const IDENTITY_POSE_COMPOSITION: PoseComposition<unknown> = {
  compose: (_parent, child) => child,
  decompose: (_parent, world) => world,
  closure: 'identity',
};

/** Whether `composition` makes a container's pose a frame, so a stored pose
 *  is local to it. False for the absolute-pose model. */
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
  for (let i = chain.length - 2; i >= 0; i--) {
    world = compose(world, adapter.getPose(chain[i]));
  }
  return world;
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
  return decompose(composeWorldPose(adapter, frame, compose), worldPose);
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
