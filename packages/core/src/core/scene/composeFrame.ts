/**
 * Folding a node's pose up its parent chain to world, and back down. Lives
 * under `core/` so the scene can lay out in world without reaching up into
 * `features/`; `features/groups/composePose` re-exports all of it.
 */

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
 * The transforms a `compose` represents **exactly**. A parent transform wider
 * than its strategy's closure is rounded to the nearest pose — for `'rigid'`
 * that means an anisotropically scaled parent turns a rotated child into a
 * parallelogram, which `{x, y, width, height, rotation}` cannot hold, so the
 * shear is dropped.
 *
 * Measured over 50,000 random parent/child pairs: rotation and translation
 * compose to within 5.7e-13, anisotropic scale to a right-angle error of 0.99.
 * See `docs/superpowers/specs/2026-09-10-group-as-frame-design.md`.
 */
export type PoseClosure = 'identity' | 'translation' | 'rigid';

/** Consumer's pose-composition strategy for hierarchical scenes. `compose`
 *  folds a child's pose (in parent's frame) up to the next frame; `decompose`
 *  is its inverse. Default is IDENTITY — an absolute-pose scene where every
 *  node already stores world coords (parent is grouping-only, no transform). */
export interface PoseComposition<TPose> {
  compose: (parent: TPose, child: TPose) => TPose;
  decompose: (parent: TPose, world: TPose) => TPose;
  closure: PoseClosure;
}

/** Default pose-composition strategy: IDENTITY. Both `compose` and
 *  `decompose` return the child/world pose unchanged, modeling an
 *  absolute-pose scene where every node stores world coords and parents are
 *  grouping-only (no transform). With this strategy `composeWorldPose`
 *  returns a node's own raw pose and `rebaseLocalPose` is a no-op. */
export const IDENTITY_POSE_COMPOSITION: PoseComposition<unknown> = {
  compose: (_parent, child) => child,
  decompose: (_parent, world) => world,
  closure: 'identity',
};

/**
 * Walk `id`'s parent chain (root first to id last) and fold local poses into
 * a world pose via `compose`. Returns the world pose for `id`. Cycle-safe:
 * a visited-set guard breaks if the chain ever loops back to itself.
 *
 * `compose(parent, child)` interprets `child` as expressed *in `parent`'s
 * local frame* and returns the equivalent pose in the next frame up. For a
 * standard translation-only rect: `world = { x: p.x + c.x, y: p.y + c.y,
 * width: c.width, height: c.height }`.
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
 * frame. Used when reparenting so the child's visual world position is
 * preserved despite the change of frame. Inverse of one `compose` step.
 *
 * `decompose(parent, world)` returns the local pose `child` such that
 * `compose(parent, child) === world`. For axis-aligned rects:
 * `child = { ...world, x: world.x - parent.x, y: world.y - parent.y }`.
 *
 * Pass `newParentId === null` for the root frame; the function returns
 * `worldPose` unchanged.
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
