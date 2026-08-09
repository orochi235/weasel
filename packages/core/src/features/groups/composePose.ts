/**
 * Pose composition for hierarchical scene graphs.
 *
 * As of the nesting change, `getPose(id)` on adapters returns the
 * **local** pose — relative to the object's direct parent. Anything in the
 * kit that needs to draw, hit-test, snap, or otherwise reason about world
 * coordinates routes through `composeWorldPose`, which walks the parent
 * chain and folds local poses together via a consumer-supplied `compose`.
 *
 * Pose shape is generic, so the compose strategy is too. For the common
 * `{x, y, width, height}` axis-aligned rect, use `composeRectPose` —
 * translation only, child dimensions preserved. Custom pose shapes (paths,
 * matrix transforms) supply their own.
 *
 * The inverse — `rebaseLocalPose` — converts a world-space pose into a
 * local pose under a target parent. Used when reparenting so the visual
 * world position of a child is preserved across the parent change.
 */

/** Re-exported; the declaration lives in `core/scene/types.ts`, which names
 *  it and may not import from features. */
import type { RectPose } from 'core/scene/types';
export type { RectPose };

/** Minimal adapter needed by `composeWorldPose` and friends — pose lookup plus parent walk. */
export interface PoseAdapter<TPose> {
  getPose(id: string): TPose;
  getParent(id: string): string | null;
}

/** Consumer's pose-composition strategy for hierarchical scenes. `compose`
 *  folds a child's pose (in parent's frame) up to the next frame; `decompose`
 *  is its inverse. Default is IDENTITY — an absolute-pose scene where every
 *  node already stores world coords (parent is grouping-only, no transform). */
export interface PoseComposition<TPose> {
  compose: (parent: TPose, child: TPose) => TPose;
  decompose: (parent: TPose, world: TPose) => TPose;
}

/** Default pose-composition strategy: IDENTITY. Both `compose` and
 *  `decompose` return the child/world pose unchanged, modeling an
 *  absolute-pose scene where every node stores world coords and parents are
 *  grouping-only (no transform). With this strategy `composeWorldPose`
 *  returns a node's own raw pose and `rebaseLocalPose` is a no-op. */
export const IDENTITY_POSE_COMPOSITION: PoseComposition<unknown> = {
  compose: (_parent, child) => child,
  decompose: (_parent, world) => world,
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
    chain.push(cursor);
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
 * Default `compose` for axis-aligned rectangles. Adds translation; preserves
 * child width/height. Treat as the canonical compose for any
 * `{x, y, width, height}` pose under a translation-only hierarchy.
 *
 * Generic over the concrete pose type so callers with a wider pose
 * (e.g. `RectPose & { rotation }`) can pass it through; the extra fields
 * are taken from the child unchanged.
 */
export function composeRectPose<TPose extends RectPose>(parent: TPose, child: TPose): TPose {
  return {
    ...child,
    x: parent.x + child.x,
    y: parent.y + child.y,
  };
}

/**
 * Translate a `RectPose`-shaped pose by `(dx, dy)`. Suitable as the default
 * `translatePose` for `useMove` when poses carry top-level `x`/`y`. Other
 * fields (width/height, plus any extra props on `TPose`) are preserved.
 */
export function translateRectPose<TPose extends RectPose>(pose: TPose, dx: number, dy: number): TPose {
  return { ...pose, x: pose.x + dx, y: pose.y + dy };
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
  if (newParentId === null) return worldPose;
  const parentWorld = composeWorldPose(adapter, newParentId, compose);
  return decompose(parentWorld, worldPose);
}

/** Inverse of `composeRectPose` — subtracts parent translation. */
export function decomposeRectPose<TPose extends RectPose>(parent: TPose, world: TPose): TPose {
  return {
    ...world,
    x: world.x - parent.x,
    y: world.y - parent.y,
  };
}

/**
 * Build a `(id) => world pose | null` callback over a `PoseAdapter`.
 * Convenience for RenderLayers that take a `getPose` callback (selection
 * overlays, debug layers, etc.) so consumers don't hand-write a
 * `composeWorldPose` call per layer.
 *
 * Returns `null` when `adapter.getPose` or `adapter.getParent` throws — the
 * common case is an id removed mid-render between selection state and the
 * next paint. Layers should treat `null` as "skip this id."
 */
export function worldPoseLookup<TPose>(
  adapter: PoseAdapter<TPose>,
  compose: (parent: TPose, child: TPose) => TPose,
): (id: string) => TPose | null {
  return (id: string) => {
    try {
      return composeWorldPose(adapter, id, compose);
    } catch {
      return null;
    }
  };
}
