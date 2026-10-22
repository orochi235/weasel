/**
 * Writing a group's `fill` and `stroke` on its `<g>`, where SVG's cascade
 * carries each property down on its own: a child that inherits a paint has to
 * leave out every attribute of it, and one that does not has to state every
 * attribute a group above it set, or it picks the group's up.
 */
import type { PaintServerRegistry } from './gradients';
import { paintAttrs, strokeAttrsFor, type Warn } from './strokeAttrs';
import type { SvgGroupNode, SvgInherits } from './types';

const FILL_ATTRS = ['fill', 'fill-opacity'];
const STROKE_ATTRS = [
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-miterlimit', 'marker-start', 'marker-mid', 'marker-end',
];

/** SVG's initial value of each attribute a group can set. */
const INITIAL: Record<string, string> = {
  'fill': '#000000', 'fill-opacity': '1', 'stroke': 'none', 'stroke-width': '1', 'stroke-opacity': '1',
  'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-dasharray': 'none', 'stroke-dashoffset': '0',
  'stroke-miterlimit': '4', 'marker-start': 'none', 'marker-mid': 'none', 'marker-end': 'none',
};

/** The paint attributes `node` writes on its `<g>`: those it holds and does
 *  not take from a group above. */
export function groupPaintAttrs(node: SvgGroupNode, registry: PaintServerRegistry, warn: Warn): string[] {
  const out: string[] = [];
  if (node.fill && !node.inherits?.fill) out.push(...paintAttrs(node.fill, 'fill', registry));
  if (node.stroke && !node.inherits?.stroke) out.push(...strokeAttrsFor(node.stroke, registry, warn));
  return out;
}

/** The attribute names in `attrs`, each written `name="value"`. */
export function attrNames(attrs: readonly string[]): string[] {
  return attrs.map((a) => a.slice(0, a.indexOf('=')));
}

const START_TAG = /<(path|text)\b([^>]*?)(\/?)>/g;
const ATTR = /\s([\w:-]+)="[^"]*"/g;

/**
 * A leaf's markup fitted to the attributes `painted` names, which groups
 * above it set: on its first element, those of a paint it `inherits` are
 * dropped; on every `<path>` and `<text>`, those of a paint it does not are
 * stated at their initial value where it says nothing.
 */
export function fitLeafXml(xml: string, inherits: SvgInherits | undefined, painted: ReadonlySet<string>): string {
  if (painted.size === 0 && !inherits) return xml;
  const dropped = new Set([...(inherits?.fill ? FILL_ATTRS : []), ...(inherits?.stroke ? STROKE_ATTRS : [])]);
  let first = true;
  return xml.replace(START_TAG, (_tag, name: string, body: string, close: string) => {
    let attrs = body;
    if (first) attrs = attrs.replace(ATTR, (whole, n: string) => (dropped.has(n) ? '' : whole));
    first = false;
    const has = new Set([...attrs.matchAll(ATTR)].map((m) => m[1]));
    const resets = [...painted].filter((n) => !has.has(n) && !dropped.has(n) && n in INITIAL);
    return `<${name}${attrs}${resets.map((n) => ` ${n}="${INITIAL[n]}"`).join('')}${close}>`;
  });
}
