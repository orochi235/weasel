/**
 * Pose composition for hierarchical scene graphs.
 *
 * `getPose(id)` on adapters returns the **local** pose — relative to the
 * object's direct parent. Anything in the kit that needs world coordinates
 * routes through `composeWorldPose`, which folds local poses together via a
 * consumer-supplied `compose`.
 */

import { applyToPoint, multiply, poseFrameInverseOf, poseFrameOf, poseLinearOf, rotate, type Affine } from '@weasel-js/geom';
import type { RectPose } from 'core/scene/types';
export type { RectPose };

import {
  IDENTITY_POSE_COMPOSITION,
  composesFrames,
  composeWorldPose,
  frameAtOrAbove,
  rebaseLocalPose,
  type PoseAdapter,
  type PoseClosure,
  type PoseComposition,
} from 'core/scene/composeFrame';
export { IDENTITY_POSE_COMPOSITION, composesFrames, composeWorldPose, frameAtOrAbove, rebaseLocalPose };
export type { PoseAdapter, PoseClosure, PoseComposition };

/**
 * `compose` for axis-aligned rectangles under a translation-only hierarchy.
 * Adds translation; every other field is taken from the child unchanged.
 */
export function composeRectPose<TPose extends RectPose>(parent: TPose, child: TPose): TPose {
  return {
    ...child,
    x: parent.x + child.x,
    y: parent.y + child.y,
  };
}

/** Translate a `RectPose`-shaped pose by `(dx, dy)`; other fields are preserved. */
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

/** `pose` turned to `rotation`, which a pose that named none keeps unnamed
 *  while it is zero. */
function withRotation<TPose extends RectPose>(pose: TPose, rotation: number): TPose {
  if (rotation === 0 && pose.rotation === undefined) return pose;
  return { ...pose, rotation };
}

/** `pose` with the linear part `linear` held as `rotation` and whatever is
 *  left over as `transform`, which is dropped when nothing is. */
function withLinear<TPose extends RectPose>(pose: TPose, rotation: number, linear: Affine): TPose {
  const [a, b, c, d] = multiply(rotate(-rotation), linear);
  const plain = Math.abs(a - 1) < 1e-12 && Math.abs(b) < 1e-12 && Math.abs(c) < 1e-12 && Math.abs(d - 1) < 1e-12;
  const next: RectPose = withRotation({ ...pose }, rotation);
  if (plain) delete next.transform;
  else next.transform = [a, b, c, d];
  return next as TPose;
}

/** `pose` moved so its box center is at `(cx, cy)`. */
function centeredAt<TPose extends RectPose>(pose: TPose, cx: number, cy: number): TPose {
  return { ...pose, x: cx - pose.width / 2, y: cy - pose.height / 2 };
}

const NO_FRAME: Affine = [1, 0, 0, 1, 0, 0];

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
 * Reduces to `composeRectPose` when the parent is upright. A parent's
 * `transform` composes too, and what the child's box and rotation cannot hold
 * of the result lands in the child's own `transform`.
 */
export function composeRigidPose<TPose extends RectPose>(parent: TPose, child: TPose): TPose {
  const pr = parent.rotation ?? 0;
  const frame = poseLinearOf(parent) && poseFrameOf(parent);
  if (frame) {
    const [cx, cy] = applyToPoint(frame, parent.x + child.x + child.width / 2, parent.y + child.y + child.height / 2);
    const linear = multiply(frame, poseFrameOf(child) ?? NO_FRAME);
    return withLinear(centeredAt(child, cx, cy), (child.rotation ?? 0) + pr, linear);
  }
  const [wcx, wcy] = turn(
    parent.x + parent.width / 2,
    parent.y + parent.height / 2,
    pr,
    parent.x + child.x + child.width / 2,
    parent.y + child.y + child.height / 2,
  );
  return withRotation({ ...child, x: wcx - child.width / 2, y: wcy - child.height / 2 }, (child.rotation ?? 0) + pr);
}

/** Inverse of `composeRigidPose` — un-turns about the parent's center, then
 *  subtracts the parent's offset. */
export function decomposeRigidPose<TPose extends RectPose>(parent: TPose, world: TPose): TPose {
  const pr = parent.rotation ?? 0;
  // A singular transform has no inverse: the container draws nothing, and the turn alone is undone.
  const back = poseLinearOf(parent) && poseFrameInverseOf(parent);
  if (back) {
    const [ux, uy] = applyToPoint(back, world.x + world.width / 2, world.y + world.height / 2);
    const linear = multiply(back, poseFrameOf(world) ?? NO_FRAME);
    return withLinear(centeredAt(world, ux - parent.x, uy - parent.y), (world.rotation ?? 0) - pr, linear);
  }
  const [ux, uy] = turn(
    parent.x + parent.width / 2,
    parent.y + parent.height / 2,
    -pr,
    world.x + world.width / 2,
    world.y + world.height / 2,
  );
  return withRotation({ ...world, x: ux - parent.x - world.width / 2, y: uy - parent.y - world.height / 2 }, (world.rotation ?? 0) - pr);
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
 * Build a `(id) => world pose | null` callback over a `PoseAdapter`, for
 * RenderLayers that take a `getPose` callback.
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
