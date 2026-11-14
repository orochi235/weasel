/** How `svgNodesFromKit` carries a container's paint to the leaves that inherit it. */
import { INHERIT, isSolidPaint, type Fill, type Stroke } from '@weasel-js/core';
import type { SvgKitLeafData } from './fromKit';
import { svgPaintFromKit, svgStrokeFromKit, type SvgKitPose } from './kitPaint';
import type { SvgGroupNode, SvgNode } from './types';

/** What a leaf's `'inherit'` fill and stroke resolve to — its nearest
 *  enclosing container's; `null` for none. */
export interface SvgKitInherited {
  fill: Fill | null;
  stroke: Stroke | null;
}
export const NO_UP_PAINT: SvgKitInherited = { fill: null, stroke: null };

/** Whether SVG's cascade can carry `p` to a child as is: a box-relative
 *  paint resolves against the group's box there, and the kit's against the child's. */
const carries = (p: { paint?: unknown } | null): boolean => p != null && isSolidPaint(p.paint as never);

/** A container's paint as its group's: its own where it has one, marked
 *  inherited where it takes it from above. */
export function groupPaintFromKit(own: SvgKitLeafData | null, below: SvgKitInherited, pose: SvgKitPose): Partial<SvgGroupNode> {
  const out: Partial<SvgGroupNode> = {};
  if (below.fill?.paint) out.fill = svgPaintFromKit(below.fill.paint, pose);
  const stroke = svgStrokeFromKit(below.stroke, pose);
  if (stroke) out.stroke = stroke;
  const fill = own?.fill === INHERIT && carries(below.fill);
  const strokes = own?.stroke === INHERIT && carries(below.stroke);
  if (fill || strokes) out.inherits = { ...(fill ? { fill: true } : {}), ...(strokes ? { stroke: true } : {}) };
  return out;
}

/** `data` with its `'inherit'` fields replaced by what they resolve to. */
export function resolvedData(data: SvgKitLeafData, up: SvgKitInherited): SvgKitLeafData {
  if (data.fill !== INHERIT && data.stroke !== INHERIT) return data;
  return {
    ...data,
    ...(data.fill === INHERIT ? { fill: up.fill } : {}),
    ...(data.stroke === INHERIT ? { stroke: up.stroke } : {}),
  };
}

/** `out` marked as taking from its group what `data` inherits, where SVG's
 *  cascade carries it as it is, so the serializer leaves it to the group. */
export function markInherits(out: SvgNode | null, data: SvgKitLeafData, up: SvgKitInherited): SvgNode | null {
  if (out === null || (out.kind !== 'path' && out.kind !== 'text')) return out;
  const fill = data.fill === INHERIT && carries(up.fill);
  const stroke = data.stroke === INHERIT && carries(up.stroke);
  if (fill || stroke) out.inherits = { ...(fill ? { fill: true } : {}), ...(stroke ? { stroke: true } : {}) };
  return out;
}
