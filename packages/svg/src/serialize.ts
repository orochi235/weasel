/**
 * Serialize a `SvgNode[]` tree to an SVG document string. Every path leaf is
 * emitted as a `<path>`, even shapes that started as `<rect>` etc.
 */

import { escapeAttr, escapeText } from './xmlEscape';
import type { Stroke } from '@weasel-js/core';
import { isSolidPaint } from '@weasel-js/core';
import { metaAttrsXml, metaElementsXml } from './metaXml';
import type {
  SerializeOptions, SvgGroupNode,
  SvgNode, SvgPathNode, SvgImageNode,
} from './types';
import { serializePathD } from './path-serializer';
import { pathAsSvgDraws } from './openSubpathFill';
import { formatMatrix, trimNumber } from './transform';
import { PaintServerRegistry, WEASEL_NS, WEASEL_NS_PREFIX } from './gradients';
import { attrNames, fitLeafXml, groupPaintAttrs } from './groupPaintXml';

const NOTHING_PAINTED: ReadonlySet<string> = new Set();
import { boxTransformAttr } from './placeBox';
import { computeBounds, pathBounds } from './serializeBounds';
import { paintAttrs, strokeAttrsFor, strokePaintAsFillAttrs, type Warn } from './strokeAttrs';
import {
  hasVariableWidth, strokeGroupXml, strokeOutlineXml, variableWidthAttrs, writesVariableWidth,
} from './variableWidthSvg';
import { textXml } from './serializeText';
import { prettyXml } from './prettyXml';

/**
 * Produce an SVG document string. The root `viewBox` is `opts.viewBox` if
 * supplied, otherwise a tight bounding box around every leaf.
 */
export function serializeSvg(nodes: SvgNode[], opts: SerializeOptions = {}): string {
  const registry = new PaintServerRegistry();
  registerPaintServers(nodes, registry);

  const bounds = opts.viewBox ?? computeBounds(nodes);
  const vb = `${trimNumber(bounds.x)} ${trimNumber(bounds.y)} ${trimNumber(bounds.width)} ${trimNumber(bounds.height)}`;
  const namespaces = opts.namespaces ?? {};

  const rootAttrs: string[] = [`xmlns="http://www.w3.org/2000/svg"`];
  // Only when something needs it, so a document of ordinary paints carries no
  // trace of it. The pre-pass above has seen every paint, so this answer is final.
  if ((registry.usesPrivateNamespace() || writesVariableWidth(nodes)) && namespaces[WEASEL_NS_PREFIX] == null) {
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
  // Once per message: a hundred inner-aligned strokes are one fact.
  const said = new Set<string>();
  const warn: Warn = (m) => {
    if (!opts.onWarn || said.has(m)) return;
    said.add(m);
    opts.onWarn(m);
  };
  const bodyXml = nodes.map((n) => nodeXml(n, registry, namespaces, warn, opts.textLayout)).join('');

  const titleXml = opts.title && opts.title.length > 0
    ? `<title>${escapeText(opts.title)}</title>`
    : '';

  const xml = `<svg ${rootAttrs.join(' ')}>${titleXml}${defsXml}${docMetaXml}${bodyXml}</svg>`;
  return opts.pretty ? prettyXml(xml) : xml;
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
      registerMarkers(n.stroke, registry);
    } else if (n.kind === 'text') {
      // This pre-pass is load-bearing: `<defs>` is emitted before the body, so
      // a paint first seen while writing an element would be referenced by an
      // id that no definition backs.
      registerTextPaint(n.fill?.paint, registry);
      registerTextPaint(n.stroke?.paint, registry);
      registerMarkers(n.stroke, registry);
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

/** Mint a `<defs>` id for every marker a stroke names, before the body is
 *  written — same reason as the paint pre-pass above. */
function registerMarkers(stroke: Pick<Stroke, 'markerStart' | 'markerMid' | 'markerEnd'> | undefined, registry: PaintServerRegistry): void {
  if (!stroke) return;
  for (const ref of [stroke.markerStart, stroke.markerMid, stroke.markerEnd]) {
    if (ref !== undefined) registry.markerId(ref);
  }
}

type LayoutOf = SerializeOptions['textLayout'];

function nodeXml(
  node: SvgNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn, layoutOf: LayoutOf,
  painted: ReadonlySet<string> = NOTHING_PAINTED,
): string {
  const kind = kindXml(node, registry, namespaces, warn, layoutOf, painted);
  const xml = node.kind === 'path' || node.kind === 'text' ? fitLeafXml(kind, node.inherits, painted) : kind;
  if (!node.hidden) return xml;
  // A variable-width stroke's outline follows its path, and hides with it.
  return xml.replace(/^<[\w:]+/, (open) => `${open} display="none"`)
    .replace(/<path (?=[^>]*:role="stroke-outline")/, '<path display="none" ');
}

function kindXml(
  node: SvgNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn, layoutOf: LayoutOf,
  painted: ReadonlySet<string>,
): string {
  if (node.kind === 'group') return groupXml(node, registry, namespaces, warn, layoutOf, painted);
  if (node.kind === 'text') return textXml(node, registry, namespaces, warn, layoutOf?.(node));
  if (node.kind === 'image') return imageXml(node, namespaces);
  const drawn = pathAsSvgDraws(node);
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
function imageXml(node: SvgImageNode, namespaces: Record<string, string>): string {
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
  const href = `href="${escapeAttr(node.href)}"`;

  if (!node.source && !node.flipX && !node.flipY) {
    const attrs = [href, box, 'preserveAspectRatio="none"', ...outer].join(' ');
    if (metaEls) return `<image ${attrs}${metaAttrs}>${metaEls}</image>`;
    return `<image ${attrs}${metaAttrs}/>`;
  }

  const src = node.source ?? { x: 0, y: 0, width: 1, height: 1 };
  const viewBox = [src.x, src.y, src.width, src.height].map(trimNumber).join(' ');
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
  const paint = groupPaintAttrs(node, registry, warn);
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
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  const head = attrs.length > 0
    ? `<g ${attrs.join(' ')}${metaAttrs}>`
    : `<g${metaAttrs}>`;
  const body = node.children.map((c) => nodeXml(c, registry, namespaces, warn, layoutOf, below)).join('');
  return `${head}${body}${metaElementsXml(node.meta, namespaces)}</g>`;
}

function pathXml(
  node: SvgPathNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn,
): string {
  const attrs: string[] = [`d="${serializePathD(node.path)}"`];
  const fillAttrs = paintAttrs(node.fill, 'fill', registry);
  for (const a of fillAttrs) attrs.push(a);
  // Only when it diverges from SVG's default ('nonzero').
  if (node.path.kind === 'polygon' && node.path.fillRule === 'evenodd') {
    attrs.push(`fill-rule="evenodd"`);
  }
  const varies = hasVariableWidth(node.stroke);
  if (node.stroke) {
    // A variable width's outline is exact on either side of the edge, so SVG's
    // missing alignment loses nothing.
    const strokeAttrs = strokeAttrsFor(node.stroke, registry, varies ? () => {} : warn);
    for (const a of varies ? variableWidthAttrs(node.stroke, strokeAttrs) : strokeAttrs) attrs.push(a);
  } else {
    attrs.push('stroke="none"');
  }
  const opacity = node.opacity != null && node.opacity !== 1 ? `opacity="${trimNumber(node.opacity)}"` : null;
  if (opacity && !varies) attrs.push(opacity);
  const transform = rotationAttr(node);
  if (transform) attrs.push(transform);
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  const metaEls = metaElementsXml(node.meta, namespaces);
  const xml = metaEls
    ? `<path ${attrs.join(' ')}${metaAttrs}>${metaEls}</path>`
    : `<path ${attrs.join(' ')}${metaAttrs}/>`;
  if (!varies) return xml;
  const both = xml + strokeOutlineXml(node.path, node.stroke!, strokePaintAsFillAttrs(node.stroke!, registry), transform);
  return opacity ? strokeGroupXml(opacity, both) : both;
}

/** `transform="rotate(...)"` about the center of `node`'s path, or null. */
function rotationAttr(node: SvgPathNode): string | null {
  if (node.rotation == null || node.rotation === 0) return null;
  const b = pathBounds(node.path);
  const cx = b.minX + (b.maxX - b.minX) / 2;
  const cy = b.minY + (b.maxY - b.minY) / 2;
  const deg = (node.rotation * 180) / Math.PI;
  return `transform="rotate(${trimNumber(deg)} ${trimNumber(cx)} ${trimNumber(cy)})"`;
}
