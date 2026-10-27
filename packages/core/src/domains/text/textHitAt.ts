import type { Scene } from '../../core/scene/types';
import type { RectPose } from 'core/geometry/unionBounds';
import { boundsOfPath, pathContainsPoint, type Path } from '@weasel-js/geom';
import { sceneDerivedPathOf, scenePaintedPoseOf } from '../../canvas/derivedPath';
import { derivedPartsOf } from '../../core/scene/derivedParts';
import { nodesAsShown, shownLookup } from '../../core/scene/nodeAsShown';
import { effectSourceFor } from '../pathEffects/effectSources';
import { targetTransformOf, worldToLocal } from 'core/geometry/targetFrame';
import { caretIndexAt, pointInTextPose, type StyledRun, type TextStyle, type TextVerticalAlign } from '@weasel-js/text';
import { textBoxOf } from '../../canvas/nodeShapes/textPainter';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { indexedCandidates } from '../../canvas/pickIndex/scenePickIndex';

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
 *
 * A path effect hiding a text source answers for it within the bounds of any
 * glyph it lays, counters included, with the caret at the end of the text.
 * A curved glyph takes a double-click anywhere in its axis-aligned box, wider
 * than the ink selection picks.
 *
 * The scene's pick index, read through `AUTO_POSE_DESCRIPTOR` because the
 * text box is read as a rect, narrows the walk to the nodes boxed over the
 * point when it is current; the answer is the full walk's either way.
 */
export function textHitAt<TData, TPose extends RectPose>(
  scene: Scene<TData, string, TPose>,
  read: TextReads<TData>,
  cx: number,
  cy: number,
): { id: string; caret: number } | null {
  // renderOrder() is back-to-front, so iterate in reverse and stop on the first hit.
  // Hit as painted: an open edit's draft is what the glyphs and the caret are laid out from.
  const order = indexedOrderAt(scene, cx, cy) ?? nodesAsShown(scene.overrides, scene.renderOrderNodes());
  const shown = shownLookup(scene);
  const paintedPoseOf = scenePaintedPoseOf(scene);
  const derivedPathOf = sceneDerivedPathOf(scene);
  for (let i = order.length - 1; i >= 0; i--) {
    const node = order[i];
    if (scene.isLocked(node.id) || scene.isHidden(node.id)) continue;
    if (!read.isText(node.data)) {
      const source = effectSourceFor(scene, node.id, 'text');
      const text = source === null || scene.isLocked(source) ? undefined : shown.get(source);
      if (text === undefined || !read.isText(text.data)) continue;
      const path = derivedPathOf(node);
      if (path !== null && onAGlyph(path, cx, cy)) return { id: String(source), caret: read.text(text.data).length };
      continue;
    }
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

type ShownNode<TData, TPose> = ReturnType<Scene<TData, string, TPose>['renderOrderNodes']>[number];

/** The nodes the pick index boxes over `(cx, cy)`, as shown and in render order, or null when it has no answer. */
function indexedOrderAt<TData, TPose>(
  scene: Scene<TData, string, TPose>,
  cx: number,
  cy: number,
): readonly ShownNode<TData, TPose>[] | null {
  const broad = { box: { x: cx, y: cy, width: 0, height: 0 } };
  const found = indexedCandidates(scene as never, AUTO_POSE_DESCRIPTOR, () => broad);
  return found as unknown as readonly ShownNode<TData, TPose>[] | null;
}

/** Whether `(x, y)` is within the bounds of one of `path`'s parts: a glyph's box, so a stem too thin to land on and the
 *  hole in an o still take the click. */
function onAGlyph(path: Path, x: number, y: number): boolean {
  const parts = derivedPartsOf(path);
  if (parts === undefined) return pathContainsPoint(path, x, y);
  return parts.some(({ path: part }) => {
    const b = boundsOfPath(part);
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  });
}
