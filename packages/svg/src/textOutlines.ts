/** A text node as the glyph outlines it draws: one path per paint, placed as the canvas places them. */
import { poseFrameOf, textToPathsByPaint } from '@weasel-js/core';
import { svgPaintFromKit, svgStrokeFromKit } from './kitPaint';
import { paintThroughMatrix, strokeThroughMatrix } from './paintThroughMatrix';
import type { SvgGroupNode, SvgPathNode, SvgTextNode } from './types';

/**
 * `node`'s glyphs and decoration rules as a `<g>` of filled paths, one per
 * distinct fill and stroke, in world space with the node's rotation and
 * `transform` baked in, as `textToPathsByPaint` lays them out. A box-relative
 * paint is resolved into the node's box and carried through its frame.
 *
 * The group keeps the node's `opacity`, `hidden` and `meta`. Every face the
 * text is set in must have its outlines loaded (`loadTextOutlines`); throws
 * `TextOutlinesError` when one cannot supply them.
 */
export function svgTextOutlines(node: SvgTextNode): SvgGroupNode {
  const box = { x: node.x, y: node.y, width: node.width, height: node.height };
  const pose = { ...box, rotation: node.rotation, transform: node.transform };
  const frame = poseFrameOf(pose);
  const children: SvgPathNode[] = textToPathsByPaint(node, pose).map((part) => {
    const fill = svgPaintFromKit(part.fill?.paint ?? null, box);
    const stroke = svgStrokeFromKit(part.stroke, box);
    const path: SvgPathNode = { kind: 'path', path: part.path, fill: frame ? paintThroughMatrix(fill, frame) : fill };
    if (stroke) path.stroke = frame ? strokeThroughMatrix(stroke, frame) : stroke;
    return path;
  });
  const out: SvgGroupNode = { kind: 'group', children };
  if (node.opacity != null && node.opacity !== 1) out.opacity = node.opacity;
  if (node.hidden) out.hidden = true;
  if (node.meta) out.meta = node.meta;
  return out;
}
