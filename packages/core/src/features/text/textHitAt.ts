import type { Scene } from '../../core/scene/types';
import type { RectPose } from 'core/geometry/unionBounds';
import { scenePaintedPoseOf } from '../../canvas/derivedPath';
import { targetTransformOf, worldToLocal } from 'core/geometry/targetFrame';
import { caretIndexAt, pointInTextPose, type StyledRun, type TextStyle, type TextVerticalAlign } from '@weasel-js/text';
import { textBoxOf } from '../../canvas/nodeShapes/textPainter';

/** How a node's text fields are read from its `data`. */
export interface TextReads<TData> {
  isText(data: TData): boolean;
  text(data: TData): string;
  style(data: TData): TextStyle | undefined;
  runs(data: TData): readonly StyledRun[] | undefined;
  verticalAlign(data: TData): TextVerticalAlign | undefined;
  padding(data: TData): number | undefined;
}

/**
 * The top-most unlocked text node at world `(cx, cy)`, and the caret there.
 *
 * `pointInTextPose` and `caretIndexAt` work in the node's own box, so the
 * point is taken back through the frame the node is drawn in. The whole box
 * takes the point, padding included; the caret is placed in the inset one.
 */
export function textHitAt<TData, TPose extends RectPose>(
  scene: Scene<TData, string, TPose>,
  read: TextReads<TData>,
  cx: number,
  cy: number,
): { id: string; caret: number } | null {
  // renderOrder() is back-to-front, so iterate in reverse and stop on the first hit.
  const order = scene.renderOrderNodes();
  const paintedPoseOf = scenePaintedPoseOf(scene);
  for (let i = order.length - 1; i >= 0; i--) {
    const node = order[i];
    if (scene.isLocked(node.id)) continue;
    if (!read.isText(node.data)) continue;
    const at = paintedPoseOf(node);
    const p = worldToLocal(targetTransformOf(at), cx, cy);
    if (!p) continue;
    const pose = {
      ...textBoxOf({ padding: read.padding(node.data) }, at),
      text: read.text(node.data),
      runs: read.runs(node.data) as StyledRun[] | undefined,
      style: read.style(node.data),
      verticalAlign: read.verticalAlign(node.data),
    };
    const box = { x: at.x, y: at.y, width: at.width, height: at.height };
    if (!pointInTextPose(p.x, p.y, { ...pose, ...box })) continue;
    return { id: String(node.id), caret: caretIndexAt(p.x, p.y, pose) };
  }
  return null;
}
