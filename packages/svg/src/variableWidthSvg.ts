/**
 * A stroke whose width varies — per-vertex widths, a nib, or both — in SVG,
 * which has no variable width.
 *
 * The path is written with its stroke attributes as usual but at
 * `stroke-width="0"`, which SVG draws as no stroke, and the real width, the
 * per-vertex widths, and the nib ride in the private namespace. Straight after
 * it comes the stroke's outline as a filled path in the stroke's paint, marked
 * so the parser drops it and reads the stroke back off the path instead. The
 * outline draws the marker heads, so the path carries its markers in the
 * private namespace, where no viewer draws them a second time. A node with an
 * opacity wraps the two in one group holding it, so they composite as one
 * layer.
 */
import { strokeToPath, type Stroke } from '@weasel-js/core';
import type { Path } from '@weasel-js/geom';
import { WEASEL_NS, WEASEL_NS_PREFIX } from './gradients';
import { serializePathD } from './path-serializer';
import { trimNumber } from './transform';
import type { SvgNode, SvgStroke } from './types';

const VERTEX_WIDTHS = 'vertex-widths';
const NIB = 'nib';
const WIDTH = 'stroke-width';
const ROLE = 'role';
const OUTLINE = 'stroke-outline';
const GROUP = 'stroke-group';
const MARKER_ATTR = /^(marker-(?:start|mid|end))=/;
/** An entry that falls back to the stroke's `width`. */
const UNSET = '-';

function attrOf(el: Element, name: string): string | null {
  return el.getAttributeNS(WEASEL_NS, name) ?? el.getAttribute(`${WEASEL_NS_PREFIX}:${name}`);
}

/** Whether `stroke` is written as an outline. */
export function hasVariableWidth(stroke: SvgStroke | undefined): stroke is SvgStroke {
  return (stroke?.vertexWidths?.length ?? 0) > 0 || stroke?.nib !== undefined;
}

/** Whether any path under `nodes` writes an outline, and so needs the
 *  private namespace declared. */
export function writesVariableWidth(nodes: readonly SvgNode[]): boolean {
  return nodes.some((n) => (n.kind === 'group' ? writesVariableWidth(n.children) : n.kind === 'path' && hasVariableWidth(n.stroke)));
}

const isSet = (w: number | null | undefined): w is number => typeof w === 'number' && Number.isFinite(w) && w > 0;

/** `strokeAttrs` for a variable-width stroke: the drawn width zeroed, the
 *  markers moved aside, and what the outline was made from beside them. */
export function variableWidthAttrs(stroke: SvgStroke, strokeAttrs: readonly string[]): string[] {
  const width = typeof stroke.width === 'number' ? stroke.width : stroke.width.px;
  const out = [
    ...strokeAttrs.map((a) => (a.startsWith('stroke-width=') ? 'stroke-width="0"'
      : MARKER_ATTR.test(a) ? `${WEASEL_NS_PREFIX}:${a}` : a)),
    `${WEASEL_NS_PREFIX}:${WIDTH}="${trimNumber(width)}"`,
  ];
  if (stroke.vertexWidths?.length) {
    const list = stroke.vertexWidths.map((w) => (isSet(w) ? trimNumber(w) : UNSET)).join(' ');
    out.push(`${WEASEL_NS_PREFIX}:${VERTEX_WIDTHS}="${list}"`);
  }
  if (stroke.nib) {
    // Unrounded: an angle in radians is rarely a short decimal.
    out.push(`${WEASEL_NS_PREFIX}:${NIB}="${String(stroke.nib.angle)} ${String(stroke.nib.ratio)}"`);
  }
  return out;
}

/** The outline element drawn for a variable-width stroke along `path`.
 *  `fillAttrs` paint it in the stroke's paint; `transform` is the path's own. */
export function strokeOutlineXml(path: Path, stroke: SvgStroke, fillAttrs: readonly string[], transform: string | null): string {
  const kit: Stroke = {
    width: stroke.width,
    ...(stroke.vertexWidths ? { vertexWidths: stroke.vertexWidths } : {}),
    ...(stroke.nib ? { nib: stroke.nib } : {}),
    ...(stroke.cap ? { cap: stroke.cap } : {}),
    ...(stroke.join ? { join: stroke.join } : {}),
    ...(stroke.dash ? { dash: stroke.dash } : {}),
    ...(stroke.miterLimit != null ? { miterLimit: stroke.miterLimit } : {}),
    ...(stroke.align ? { align: stroke.align } : {}),
    ...(stroke.markerStart ? { markerStart: stroke.markerStart } : {}),
    ...(stroke.markerMid ? { markerMid: stroke.markerMid } : {}),
    ...(stroke.markerEnd ? { markerEnd: stroke.markerEnd } : {}),
  };
  const outline = strokeToPath(path, kit);
  const attrs = [`d="${serializePathD(outline)}"`, ...fillAttrs, 'stroke="none"'];
  if (transform) attrs.push(transform);
  attrs.push(`${WEASEL_NS_PREFIX}:${ROLE}="${OUTLINE}"`);
  return `<path ${attrs.join(' ')}/>`;
}

/** `pathXml` and its outline in one group carrying `opacity`. */
export function strokeGroupXml(opacity: string, inner: string): string {
  return `<g ${opacity} ${WEASEL_NS_PREFIX}:${ROLE}="${GROUP}">${inner}</g>`;
}

/** The path a parsed {@link strokeGroupXml} group holds, carrying the
 *  group's opacity; anything else as it is. */
export function unwrapStrokeGroup(el: Element, node: SvgNode | SvgNode[] | null): SvgNode | SvgNode[] | null {
  if (attrOf(el, ROLE) !== GROUP || !node || Array.isArray(node) || node.kind !== 'group') return node;
  const [only] = node.children;
  if (node.children.length !== 1 || only.kind !== 'path') return node;
  return node.opacity != null ? { ...only, opacity: node.opacity * (only.opacity ?? 1) } : only;
}

/** Whether `el` is an outline written for a variable-width stroke, which the
 *  path before it already carries. */
export function isStrokeOutline(el: Element): boolean {
  return attrOf(el, ROLE) === OUTLINE;
}

/** `stroke` as read off `el`, with the width, per-vertex widths, nib, and
 *  markers a variable-width stroke keeps in the private namespace restored. */
export function withVariableWidth(el: Element, stroke: SvgStroke | undefined): SvgStroke | undefined {
  const width = parseFloat(attrOf(el, WIDTH) ?? '');
  if (!stroke || !Number.isFinite(width)) return stroke;
  const out: SvgStroke = { ...stroke, width: typeof stroke.width === 'number' ? width : { px: width } };
  const list = attrOf(el, VERTEX_WIDTHS);
  if (list) out.vertexWidths = list.trim().split(/\s+/).map((w) => (w === UNSET ? NaN : Number(w)));
  const [angle, ratio] = (attrOf(el, NIB) ?? '').trim().split(/\s+/).map(Number);
  if (Number.isFinite(angle) && Number.isFinite(ratio)) out.nib = { angle, ratio };
  for (const [attr, field] of [['marker-start', 'markerStart'], ['marker-mid', 'markerMid'], ['marker-end', 'markerEnd']] as const) {
    const id = /^url\(\s*#([^)\s]+)\s*\)$/.exec(attrOf(el, attr)?.trim() ?? '')?.[1];
    if (id) out[field] = id;
  }
  return out;
}
