import type { View } from 'core/viewport/view';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { poseRotationOf } from 'core/geometry/poseRotation';
import { boundsMissRect, type CullRect } from '../renderer/cullDrawCommands';
import { mat3, type GlMat3 } from '../renderer/math/mat3';
import { viewToMat3 } from '../renderer/math/viewToMat3';
import { rotationMatrixAbout } from './poseRotation';

/** Where a node's paint can reach, before its pose rotation — the scene
 *  slot's `paintBounds`. `null` means unknown, and the node is painted. */
export type PaintBoundsFn<TNode, TPose> = (node: TNode, pose: TPose, view: View) => Bounds | null;

/**
 * A predicate true for the nodes whose paint cannot reach `rect` (screen
 * pixels) under `view`, by `paintBounds` taken through the pose rotation
 * `wrapNodeOutput` applies and then the view. A node `paintBounds` cannot
 * bound is never culled.
 */
export function paintMissesView<TNode, TPose>(
  paintBounds: PaintBoundsFn<TNode, TPose>,
  view: View,
  rect: CullRect,
): (node: TNode, pose: TPose, layerView?: View) => boolean {
  // `layerView` is a parallax plane's own view; planes are few, so one slot
  // of memo covers a walk that meets them layer by layer.
  let last = view;
  let toScreen = viewToMat3(view);
  return (node, pose, layerView = view) => {
    if (layerView !== last) { last = layerView; toScreen = viewToMat3(layerView); }
    const b = paintBounds(node, pose, layerView);
    if (!b) return false;
    const r = poseRotationOf(pose);
    const m = r ? mat3.multiply(toScreen, rotationMatrixAbout(r.cx, r.cy, r.rotation) as GlMat3) : toScreen;
    return boundsMissRect(b, m, rect);
  };
}
