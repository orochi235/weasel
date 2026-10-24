import type { View } from 'core/viewport/view';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { poseFrameOf } from '@weasel-js/geom';
import { boundsMissRect, type CullRect } from '@weasel-js/renderer';
import { mat3, viewToMat3 } from '@weasel-js/geom';
import type { NodePaintCtx } from './nodeShapeTypes';

/** Where a node's paint can reach, before its pose frame — the scene
 *  slot's `paintBounds`. `null` means unknown, and the node is painted.
 *  `ctx.inherited` is what its `'inherit'` fill and stroke take, as `drawOne` gets it. */
export type PaintBoundsFn<TNode, TPose> = (
  node: TNode, pose: TPose, view: View, ctx?: Pick<NodePaintCtx, 'inherited'>,
) => Bounds | null;

/**
 * A predicate true for the nodes whose paint cannot reach `rect` (screen
 * pixels) under `view`, by `paintBounds` taken through the pose frame
 * (`poseFrameOf`) `wrapNodeOutput` applies and then the view. A node `paintBounds` cannot
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
    const frame = poseFrameOf(pose);
    const m = frame ? mat3.multiply(toScreen, mat3.fromAffine(frame)) : toScreen;
    return boundsMissRect(b, m, rect);
  };
}
