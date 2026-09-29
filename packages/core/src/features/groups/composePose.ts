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

/** Re-exported from `core/scene/composeFrame.ts`, for the same reason. */
import {
  IDENTITY_POSE_COMPOSITION,
  composeWorldPose,
  frameAtOrAbove,
  rebaseLocalPose,
  type PoseAdapter,
  type PoseClosure,
  type PoseComposition,
} from 'core/scene/composeFrame';
export { IDENTITY_POSE_COMPOSITION, composeWorldPose, frameAtOrAbove, rebaseLocalPose };
export type { PoseAdapter, PoseClosure, PoseComposition };

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

/** Inverse of `composeRectPose` — subtracts parent translation. */
export function decomposeRectPose<TPose extends RectPose>(parent: TPose, world: TPose): TPose {
  return {
    ...world,
    x: world.x - parent.x,
    y: world.y - parent.y,
  };
}

/** Turn `(x, y)` about `(cx, cy)` by `r` radians. */
function turn(cx: number, cy: number, r: number, x: number, y: number): [number, number] {
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
}

/**
 * `compose` for a container whose pose defines a **frame**: the child's local
 * pose is offset into the parent's unrotated box, then the whole thing is
 * turned about the parent's center. Rotations add; the child keeps its size.
 *
 * Reduces to `composeRectPose` when the parent is upright, so a scene that
 * never rotates a container behaves identically under either strategy.
 *
 * Exact for translation and rotation. A parent carrying scale is outside what
 * this can express — see `PoseClosure`.
 */
export function composeRigidPose<TPose extends RectPose>(parent: TPose, child: TPose): TPose {
  const pr = parent.rotation ?? 0;
  const [wcx, wcy] = turn(
    parent.x + parent.width / 2,
    parent.y + parent.height / 2,
    pr,
    parent.x + child.x + child.width / 2,
    parent.y + child.y + child.height / 2,
  );
  return {
    ...child,
    x: wcx - child.width / 2,
    y: wcy - child.height / 2,
    rotation: (child.rotation ?? 0) + pr,
  };
}

/** Inverse of `composeRigidPose` — un-turns about the parent's center, then
 *  subtracts the parent's offset. */
export function decomposeRigidPose<TPose extends RectPose>(parent: TPose, world: TPose): TPose {
  const pr = parent.rotation ?? 0;
  const [ux, uy] = turn(
    parent.x + parent.width / 2,
    parent.y + parent.height / 2,
    -pr,
    world.x + world.width / 2,
    world.y + world.height / 2,
  );
  return {
    ...world,
    x: ux - parent.x - world.width / 2,
    y: uy - parent.y - world.height / 2,
    rotation: (world.rotation ?? 0) - pr,
  };
}

/** Translation-only composition over `RectPose`. What a scene wants when a
 *  container groups its children but never turns them. */
export const RECT_POSE_COMPOSITION: PoseComposition<RectPose> = {
  compose: composeRectPose,
  decompose: decomposeRectPose,
  closure: 'translation',
};

/** Composition over `RectPose` where a container's pose is a frame: rotating
 *  the container rotates its contents. */
export const RIGID_POSE_COMPOSITION: PoseComposition<RectPose> = {
  compose: composeRigidPose,
  decompose: decomposeRigidPose,
  closure: 'rigid',
};

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
