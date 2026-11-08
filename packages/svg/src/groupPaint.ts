/**
 * Which paint a parsed node takes from its enclosing `<g>` rather than sets
 * itself — what lets a group's `fill` and `stroke` import as its container's
 * and its children's as `'inherit'`. A paint set on the root `<svg>`, or a
 * nested one, belongs to no group, so the leaves beneath keep it resolved.
 */
import { setsOwn, type StyleContext } from './cascade';
import { INHERITED_PROPERTIES } from './properties';
import { paintThroughMatrix, strokeThroughMatrix } from './paintThroughMatrix';
import { readPaint, readStroke } from './readPaint';
import type { GradientTable } from './gradients';
import type { Matrix, SvgGroupNode, SvgInherits } from './types';

/** Whether the fill and the stroke in effect were set by an enclosing `<g>`. */
export interface GroupPaintFrom {
  fill: boolean;
  stroke: boolean;
}

export const NO_GROUP_PAINT: GroupPaintFrom = { fill: false, stroke: false };

const STROKE_PROPS = INHERITED_PROPERTIES.filter((p) => p.startsWith('stroke') || p.startsWith('marker'));

const setsFill = (el: Element): boolean => setsOwn(el, 'fill');
const setsStroke = (el: Element): boolean => STROKE_PROPS.some((p) => setsOwn(el, p));

/** What a nested `<svg>`'s children take: a paint it sets is no group's. */
export function viewportPaintFrom(el: Element, from: GroupPaintFrom): GroupPaintFrom {
  return { fill: from.fill && !setsFill(el), stroke: from.stroke && !setsStroke(el) };
}

/** What an element takes from the group around it, as the node's
 *  `inherits` — an empty object when it takes nothing. */
export function inheritsFrom(el: Element, from: GroupPaintFrom): { inherits?: SvgInherits } {
  const fill = from.fill && !setsFill(el);
  const stroke = from.stroke && !setsStroke(el);
  return fill || stroke ? { inherits: { ...(fill ? { fill: true } : {}), ...(stroke ? { stroke: true } : {}) } } : {};
}

/**
 * A `<g>`'s paint for its children and what they take from it: the fill and
 * stroke in effect under it, wherever it or a group above it sets them.
 */
export function groupPaint(
  el: Element,
  from: GroupPaintFrom,
  style: StyleContext,
  ctm: Matrix,
  gradients: GradientTable,
  onWarn: (m: string) => void,
): { paint: Pick<SvgGroupNode, 'fill' | 'stroke' | 'inherits'>; children: GroupPaintFrom } {
  const children = { fill: from.fill || setsFill(el), stroke: from.stroke || setsStroke(el) };
  const paint: Pick<SvgGroupNode, 'fill' | 'stroke' | 'inherits'> = {};
  if (children.fill) paint.fill = paintThroughMatrix(readPaint(style, 'fill', '#000000', gradients, onWarn), ctm, onWarn);
  const stroke = children.stroke ? readStroke(style, gradients, onWarn) : undefined;
  if (stroke) paint.stroke = strokeThroughMatrix(stroke, ctm, onWarn);
  return { paint: { ...paint, ...inheritsFrom(el, from) }, children };
}
