/**
 * Serialize a `SvgNode[]` tree to an SVG document string. Every path leaf is
 * emitted as a `<path>`, even shapes that started as `<rect>` etc.
 */

import { escapeAttr, escapeText, holdsNonXmlChar } from './xmlEscape';
import type { Path } from '@weasel-js/core';
import { isSolidPaint } from '@weasel-js/core';
import { metaAttrsXml, metaElementsXml } from './metaXml';
import type {
  SerializeOptions, SvgGroupNode, SvgInherits,
  SvgNode, SvgImageNode, SvgPathNode, SvgTextNode,
} from './types';
import { serializePathD } from './path-serializer';
import { pathAsSvgDraws } from './openSubpathFill';
import { formatMatrix, trimNumber } from './transform';
import { PaintServerRegistry, WEASEL_NS, WEASEL_NS_PREFIX } from './gradients';
import { attrNames, fitLeafXml, groupPaintAttrs } from './groupPaintXml';

const NOTHING_PAINTED: ReadonlySet<string> = new Set();
import { boxTransformAttr } from './placeBox';
import { exportedHref } from './bitmapHref';
import { computeBounds, pathBounds } from './serializeBounds';
import { paintAttrs, strokeAttrsFor, strokePaintAsFillAttrs, type Warn } from './strokeAttrs';
import { withTrimsDrawn } from './trimmedStroke';
import { withDashesResolved } from './resolvedDashes';
import { type SeatedPathNode, withSeatedHeads } from './seatedHeads';
import {
  writesOutline, strokeGroupXml, strokeOutlineXml, outlinedStrokeAttrs, writesOutlines,
} from './strokeOutlineSvg';
import { textXml } from './serializeText';
import { fontFacesXml, withTextMode } from './textModes';
import { alignedTextXml, hasAlignedTextStroke } from './alignedTextStroke';
import { prettyXml } from './prettyXml';
import { BOOLEAN_ATTR } from './booleanGroup';
import { TEXT_FRAME_ATTR } from './framedText';
import { RAD_TO_DEG } from '@weasel-js/geom';

/**
 * Produce an SVG document string. The root `viewBox` is `opts.viewBox` if
 * supplied, otherwise a tight box around everything the tree draws, strokes
 * and marker heads included.
 */
export function serializeSvg(given: SvgNode[], opts: SerializeOptions = {}): string {
  const registry = new PaintServerRegistry();
  // Once per message: a hundred inner-aligned strokes are one fact.
  const said = new Set<string>();
  const warn: Warn = (m) => {
    if (!opts.onWarn || said.has(m)) return;
    said.add(m);
    opts.onWarn(m);
  };
  const text = withTextMode(given, opts.text ?? 'live', warn);
  const nodes = withTrimsDrawn(withDashesResolved(text.nodes));
  registerPaintServers(nodes, registry);

  const bounds = opts.viewBox ?? computeBounds(given);
  const vb = `${trimNumber(bounds.x)} ${trimNumber(bounds.y)} ${trimNumber(bounds.width)} ${trimNumber(bounds.height)}`;
  const namespaces = opts.namespaces ?? {};
  if (holdsNonXmlChar(stringsIn([given, opts.title, opts.documentMeta]))) {
    warn('text holds characters XML cannot hold (a control character, U+FFFE, U+FFFF, or half a surrogate pair); each is written as U+FFFD');
  }
  // Written first: a marker's def is registered as an element references it,
  // which decides whether its head is seated.
  const bodyXml = nodes.map((n) => nodeXml(n, registry, namespaces, warn, opts.textLayout)).join('');

  const rootAttrs: string[] = [`xmlns="http://www.w3.org/2000/svg"`];
  // Only when something needs it, so a document of ordinary paints carries no
  // trace of it. The body is written, so every def and attribute is known.
  if ((registry.usesPrivateNamespace() || writesOutlines(nodes)) && namespaces[WEASEL_NS_PREFIX] == null) {
    rootAttrs.push(`xmlns:${WEASEL_NS_PREFIX}="${WEASEL_NS}"`);
  }
  for (const [prefix, uri] of Object.entries(namespaces)) {
    rootAttrs.push(`xmlns:${prefix}="${escapeAttr(uri)}"`);
  }
  rootAttrs.push(`viewBox="${vb}"`);
  if (opts.width != null) rootAttrs.push(`width="${trimNumber(opts.width)}"`);
  if (opts.height != null) rootAttrs.push(`height="${trimNumber(opts.height)}"`);
  // documentMeta attrs onto the root, in declared-namespace order.
  if (opts.documentMeta) {
    for (const prefix of Object.keys(namespaces)) {
      const bucket = opts.documentMeta[prefix];
      if (!bucket?.attrs) continue;
      for (const [name, value] of Object.entries(bucket.attrs)) {
        rootAttrs.push(`${prefix}:${name}="${escapeAttr(value)}"`);
      }
    }
  }

  // After <defs>, before the geometry.
  const docMetaXml = metaElementsXml(opts.documentMeta, namespaces);

  const defsXml = registry.toDefsXml(opts.onWarn);

  const titleXml = opts.title && opts.title.length > 0
    ? `<title>${escapeText(opts.title)}</title>`
    : '';

  const xml = `<svg ${rootAttrs.join(' ')}>${titleXml}${fontFacesXml(text.faces)}${defsXml}${docMetaXml}${bodyXml}</svg>`;
  return opts.pretty ? prettyXml(xml) : xml;
}

/** Every string in `value`, joined: what the document's text and attribute values are written from. */
function stringsIn(value: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (v !== null && typeof v === 'object' && !ArrayBuffer.isView(v)) Object.values(v).forEach(walk);
  };
  walk(value);
  return out.join('\n');
}

export function registerPaintServers(nodes: readonly SvgNode[], registry: PaintServerRegistry): void {
  for (const n of nodes) {
    if (n.kind === 'group') {
      if (n.clip) registry.clipId(n.clip);
      if (n.fill?.kind === 'gradient' && !n.inherits?.fill) registry.register(n.fill.paint);
      if (n.stroke?.paint.kind === 'gradient' && !n.inherits?.stroke) registry.register(n.stroke.paint.paint);
      registerPaintServers(n.children, registry);
    } else if (n.kind === 'path') {
      if (n.fill.kind === 'gradient') registry.register(n.fill.paint);
      if (n.stroke && n.stroke.paint.kind === 'gradient') registry.register(n.stroke.paint.paint);
    } else if (n.kind === 'text') {
      // This pre-pass is load-bearing: `<defs>` is emitted before the body, so
      // a paint first seen while writing an element would be referenced by an
      // id that no definition backs.
      registerTextPaint(n.fill?.paint, registry);
      registerTextPaint(n.stroke?.paint, registry);
      for (const run of n.runs ?? []) {
        registerTextPaint(run.fill?.paint, registry);
        registerTextPaint(run.stroke?.paint, registry);
      }
    }
  }
}

/** Register one text paint if it is a paint server rather than a color. */
function registerTextPaint(
  paint: import('@weasel-js/core').Paint | null | undefined,
  registry: PaintServerRegistry,
): void {
  if (paint && !isSolidPaint(paint)) registry.register(paint);
}

type LayoutOf = SerializeOptions['textLayout'];

function nodeXml(
  node: SvgNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn, layoutOf: LayoutOf,
  painted: ReadonlySet<string> = NOTHING_PAINTED,
): string {
  const kind = kindXml(node, registry, namespaces, warn, layoutOf, painted);
  const xml = node.kind === 'path' || node.kind === 'text' ? fitLeafXml(kind, leafInherits(node), painted) : kind;
  if (!node.hidden) return xml;
  // An outlined stroke's outline follows its path, and hides with it.
  return xml.replace(/^<[\w:]+/, (open) => `${open} display="none"`)
    .replace(/<path (?=[^>]*:role="stroke-outline")/, '<path display="none" ');
}

/** What a leaf takes from its group. An outlined stroke never does: its element
 *  states a zero width that the group's stroke would otherwise replace. */
function leafInherits(node: SvgPathNode | SvgTextNode): SvgInherits | undefined {
  const outlined = node.kind === 'path' ? writesOutline(node.stroke) : hasAlignedTextStroke(node);
  if (!node.inherits?.stroke || !outlined) return node.inherits;
  const { stroke: _, ...rest } = node.inherits;
  return rest;
}

function kindXml(
  node: SvgNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn, layoutOf: LayoutOf,
  painted: ReadonlySet<string>,
): string {
  if (node.kind === 'group') return groupXml(node, registry, namespaces, warn, layoutOf, painted);
  if (node.kind === 'text') {
    const layout = layoutOf?.(node);
    return alignedTextXml(node, registry, namespaces, warn, layout) ?? textXml(node, registry, namespaces, warn, layout);
  }
  if (node.kind === 'image') return imageXml(node, namespaces, warn);
  const asDrawn = pathAsSvgDraws(node);
  const drawn = asDrawn.kind === 'path' ? withSeatedHeads(asDrawn) : asDrawn;
  return drawn.kind === 'group'
    ? groupXml(drawn, registry, namespaces, warn, layoutOf, painted)
    : pathXml(drawn, registry, namespaces, warn);
}


/**
 * Emit an `<image>`. `preserveAspectRatio="none"` is unconditional: the node
 * carries a literal box, and a viewer letterboxing it would place the pixels
 * somewhere the model never said.
 *
 * A source rect or a flip takes the cropped form described on `SvgImageNode`.
 * SVG 1.1 gives the nested `<svg>` no `transform`, so the rotation, opacity,
 * and meta go on the wrapping `<g>`.
 */
function imageXml(node: SvgImageNode, namespaces: Record<string, string>, warn: Warn): string {
  const box = `x="${trimNumber(node.x)}" y="${trimNumber(node.y)}"`
    + ` width="${trimNumber(node.width)}" height="${trimNumber(node.height)}"`;
  const outer: string[] = [];
  if (node.opacity != null && node.opacity !== 1) {
    outer.push(`opacity="${trimNumber(node.opacity)}"`);
  }
  const frame = boxTransformAttr(node);
  if (frame) outer.push(frame);
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  const metaEls = metaElementsXml(node.meta, namespaces);
  const href = `href="${escapeAttr(exportedHref(node.href, warn))}"`;

  if (!node.source && !node.flipX && !node.flipY) {
    const attrs = [href, box, 'preserveAspectRatio="none"', ...outer].join(' ');
    if (metaEls) return `<image ${attrs}${metaAttrs}>${metaEls}</image>`;
    return `<image ${attrs}${metaAttrs}/>`;
  }

  const src = node.source ?? { x: 0, y: 0, width: 1, height: 1 };
  const viewBox = [src.x, src.y, src.width, src.height].map((n) => trimNumber(n)).join(' ');
  // A mirror about the source window's center, so the flipped image still
  // fills exactly the window the viewport shows.
  const flip = node.flipX || node.flipY
    ? ` transform="matrix(${node.flipX ? -1 : 1} 0 0 ${node.flipY ? -1 : 1}`
      + ` ${trimNumber(node.flipX ? 2 * src.x + src.width : 0)}`
      + ` ${trimNumber(node.flipY ? 2 * src.y + src.height : 0)})"`
    : '';
  const head = ['<g data-weasel-image="true"', ...outer].join(' ');
  return `${head}${metaAttrs}>`
    + `<svg ${box} viewBox="${viewBox}" preserveAspectRatio="none">`
    + `<image ${href} x="0" y="0" width="1" height="1" preserveAspectRatio="none"${flip}/>`
    + `</svg>${metaEls}</g>`;
}

function groupXml(
  node: SvgGroupNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn, layoutOf: LayoutOf,
  painted: ReadonlySet<string> = NOTHING_PAINTED,
): string {
  const attrs: string[] = [];
  const paint = groupPaintAttrs(node, registry, warn, painted);
  for (const a of paint) attrs.push(a);
  const below = paint.length === 0 ? painted : new Set([...painted, ...attrNames(paint)]);
  if (node.transform) {
    const m = formatMatrix(node.transform);
    if (m) attrs.push(`transform="${m}"`);
  }
  if (node.clip) {
    attrs.push(`clip-path="url(#${registry.clipId(node.clip)})"`);
  }
  if (node.opacity != null && node.opacity !== 1) {
    attrs.push(`opacity="${trimNumber(node.opacity)}"`);
  }
  if (node.boolean) attrs.push(`${BOOLEAN_ATTR}="${node.boolean}"`);
  if (node.textFrame) attrs.push(`${TEXT_FRAME_ATTR}="true"`);
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  const head = attrs.length > 0
    ? `<g ${attrs.join(' ')}${metaAttrs}>`
    : `<g${metaAttrs}>`;
  const body = node.children.map((c) => nodeXml(c, registry, namespaces, warn, layoutOf, below)).join('');
  return `${head}${body}${metaElementsXml(node.meta, namespaces)}</g>`;
}

function pathXml(
  node: SeatedPathNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn,
): string {
  const attrs: string[] = [`d="${serializePathD(node.path)}"`];
  // A shaft cut back for its heads keeps the path as authored, for the parser.
  if (node.seat) {
    attrs.push(`${WEASEL_NS_PREFIX}:d="${serializePathD(node.seat.authored)}"`);
    registry.usePrivateNamespace();
  }
  const fillAttrs = paintAttrs(node.fill, 'fill', registry);
  for (const a of fillAttrs) attrs.push(a);
  // Only when it diverges from SVG's default ('nonzero').
  if (node.path.kind === 'polygon' && node.path.fillRule === 'evenodd') {
    attrs.push(`fill-rule="evenodd"`);
  }
  const outlined = writesOutline(node.stroke);
  if (node.stroke) {
    // An outline is exact on either side of the edge, so SVG's
    // missing alignment loses nothing.
    const strokeAttrs = strokeAttrsFor(node.stroke, registry, outlined ? () => {} : warn, node.seat);
    for (const a of outlined ? outlinedStrokeAttrs(node.stroke, strokeAttrs) : strokeAttrs) attrs.push(a);
  } else {
    attrs.push('stroke="none"');
  }
  const opacity = node.opacity != null && node.opacity !== 1 ? `opacity="${trimNumber(node.opacity)}"` : null;
  if (opacity && !outlined) attrs.push(opacity);
  const transform = rotationAttr(node.rotation, node.seat?.authored ?? node.path);
  if (transform) attrs.push(transform);
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  const metaEls = metaElementsXml(node.meta, namespaces);
  const xml = metaEls
    ? `<path ${attrs.join(' ')}${metaAttrs}>${metaEls}</path>`
    : `<path ${attrs.join(' ')}${metaAttrs}/>`;
  if (!outlined) return xml;
  const both = xml + strokeOutlineXml(node.path, node.stroke!, strokePaintAsFillAttrs(node.stroke!, registry), transform);
  return opacity ? strokeGroupXml(opacity, both) : both;
}

/** `transform="rotate(...)"` about the center of `path`, or null. */
function rotationAttr(rotation: number | undefined, path: Path): string | null {
  if (rotation == null || rotation === 0) return null;
  const b = pathBounds(path);
  const cx = b.minX + (b.maxX - b.minX) / 2;
  const cy = b.minY + (b.maxY - b.minY) / 2;
  const deg = rotation * RAD_TO_DEG;
  return `transform="rotate(${trimNumber(deg)} ${trimNumber(cx)} ${trimNumber(cy)})"`;
}
