/**
 * Serialize a `SvgNode[]` tree to an SVG document string. Every leaf is
 * emitted as a `<path>` (even shapes that started as `<rect>` etc.) —
 * lossless geometry round-trip beats round-tripping the element-kind
 * label. Gradient paints are gathered into a single `<defs>` block.
 */

import type { Path, Stroke } from '@weasel-js/core';
import { boundsOfPath } from '@weasel-js/core';
import type {
  NamespaceMeta, NamespacedElement, SerializeOptions, SvgGroupNode, SvgNode,
  SvgPaint, SvgPathNode, SvgStroke, SvgTextNode,
} from './types';
import { runsToPlainText } from '@weasel-js/core';
import { serializePathD } from './path-serializer';
import { formatMatrix, trimNumber } from './transform';
import { PaintServerRegistry } from './gradients';

/**
 * Walk the tree and produce an SVG document string. The root `<svg>`'s
 * `viewBox` is taken from `opts.viewBox` if supplied, otherwise computed
 * as a tight bounding box around every leaf.
 */
export function serializeSvg(nodes: SvgNode[], opts: SerializeOptions = {}): string {
  const registry = new PaintServerRegistry();
  registerPaintServers(nodes, registry);

  const bounds = opts.viewBox ?? computeBounds(nodes);
  const vb = `${trimNumber(bounds.x)} ${trimNumber(bounds.y)} ${trimNumber(bounds.width)} ${trimNumber(bounds.height)}`;
  const namespaces = opts.namespaces ?? {};

  const rootAttrs: string[] = [`xmlns="http://www.w3.org/2000/svg"`];
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

  // documentMeta elements after <defs>, before geometry body.
  let docMetaXml = '';
  if (opts.documentMeta) {
    for (const prefix of Object.keys(namespaces)) {
      const bucket = opts.documentMeta[prefix];
      if (!bucket?.elements) continue;
      for (const [localName, list] of Object.entries(bucket.elements)) {
        for (const el of list) docMetaXml += namespacedElementXml(prefix, localName, el);
      }
    }
  }

  const defsXml = registry.toDefsXml(opts.onWarn);
  const bodyXml = nodes.map((n) => nodeXml(n, registry, namespaces)).join('');

  // `<title>` goes immediately inside `<svg>` per SVG-spec convention; it's
  // an accessibility hook and (for our purposes) a stable place to round-trip
  // the user-visible document title.
  const titleXml = opts.title && opts.title.length > 0
    ? `<title>${escapeText(opts.title)}</title>`
    : '';

  return `<svg ${rootAttrs.join(' ')}>${titleXml}${defsXml}${docMetaXml}${bodyXml}</svg>`;
}

function namespacedElementXml(prefix: string, localName: string, el: NamespacedElement): string {
  const attrs: string[] = [];
  for (const [name, value] of Object.entries(el.attrs)) {
    attrs.push(`${name}="${escapeAttr(value)}"`);
  }
  const head = attrs.length > 0 ? `<${prefix}:${localName} ${attrs.join(' ')}>` : `<${prefix}:${localName}>`;
  let body = '';
  if (el.children) {
    for (const [childName, list] of Object.entries(el.children)) {
      for (const child of list) body += namespacedElementXml(prefix, childName, child);
    }
  } else if (el.text != null) {
    body = escapeText(el.text);
  }
  return `${head}${body}</${prefix}:${localName}>`;
}

function metaAttrsXml(meta: NamespaceMeta | undefined, namespaces: Record<string, string>): string {
  if (!meta) return '';
  const parts: string[] = [];
  for (const prefix of Object.keys(namespaces)) {
    const bucket = meta[prefix];
    if (!bucket?.attrs) continue;
    for (const [name, value] of Object.entries(bucket.attrs)) {
      parts.push(`${prefix}:${name}="${escapeAttr(value)}"`);
    }
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function metaElementsXml(meta: NamespaceMeta | undefined, namespaces: Record<string, string>): string {
  if (!meta) return '';
  let out = '';
  for (const prefix of Object.keys(namespaces)) {
    const bucket = meta[prefix];
    if (!bucket?.elements) continue;
    for (const [localName, list] of Object.entries(bucket.elements)) {
      for (const el of list) out += namespacedElementXml(prefix, localName, el);
    }
  }
  return out;
}

function registerPaintServers(nodes: SvgNode[], registry: PaintServerRegistry): void {
  for (const n of nodes) {
    if (n.kind === 'group') {
      registerPaintServers(n.children, registry);
    } else if (n.kind === 'path') {
      if (n.fill.kind === 'gradient') registry.register(n.fill.paint);
      if (n.stroke && n.stroke.paint.kind === 'gradient') registry.register(n.stroke.paint.paint);
    } else if (n.kind === 'text') {
      // Text paints flow through `style` / `runs` rather than a top-level
      // SvgPaint, so register direct FillStyle references when present. This
      // pre-pass is load-bearing: `<defs>` is emitted before the body, so a
      // paint first seen while writing an element would be referenced by an
      // id that no definition backs.
      registerTextPaint(n.style?.fill, registry);
      registerTextPaint(n.style?.stroke?.paint, registry);
      for (const run of n.runs ?? []) {
        registerTextPaint(run.fill, registry);
        registerTextPaint(run.stroke?.paint, registry);
      }
    }
  }
}

/** Register one text paint if it is a paint server rather than a colour. */
function registerTextPaint(
  paint: import('@weasel-js/core').FillStyle | undefined,
  registry: PaintServerRegistry,
): void {
  if (paint && !('color' in paint)) registry.register(paint);
}

function nodeXml(node: SvgNode, registry: PaintServerRegistry, namespaces: Record<string, string>): string {
  if (node.kind === 'group') return groupXml(node, registry, namespaces);
  if (node.kind === 'text') return textXml(node, registry, namespaces);
  return pathXml(node, registry, namespaces);
}

function groupXml(node: SvgGroupNode, registry: PaintServerRegistry, namespaces: Record<string, string>): string {
  const attrs: string[] = [];
  if (node.transform) {
    const m = formatMatrix(node.transform);
    if (m) attrs.push(`transform="${m}"`);
  }
  if (node.opacity != null && node.opacity !== 1) {
    attrs.push(`opacity="${trimNumber(node.opacity)}"`);
  }
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  // `metaAttrs` already starts with a leading space (or is empty), so we
  // can splice it after the existing attr list without extra logic.
  const head = attrs.length > 0
    ? `<g ${attrs.join(' ')}${metaAttrs}>`
    : `<g${metaAttrs}>`;
  const body = node.children.map((c) => nodeXml(c, registry, namespaces)).join('');
  return `${head}${body}${metaElementsXml(node.meta, namespaces)}</g>`;
}

function pathXml(node: SvgPathNode, registry: PaintServerRegistry, namespaces: Record<string, string>): string {
  const attrs: string[] = [`d="${serializePathD(node.path)}"`];
  const fillAttrs = paintAttrs(node.fill, 'fill', registry);
  for (const a of fillAttrs) attrs.push(a);
  // Emit fill-rule only when it diverges from SVG's default ('nonzero').
  // RectPath has no fillRule field — only PolygonPath carries one.
  if (node.path.kind === 'polygon' && node.path.fillRule === 'evenodd') {
    attrs.push(`fill-rule="evenodd"`);
  }
  if (node.stroke) {
    const strokeAttrs = strokeAttrsFor(node.stroke, registry);
    for (const a of strokeAttrs) attrs.push(a);
  } else {
    attrs.push('stroke="none"');
  }
  if (node.opacity != null && node.opacity !== 1) {
    attrs.push(`opacity="${trimNumber(node.opacity)}"`);
  }
  if (node.rotation != null && node.rotation !== 0) {
    const b = pathBounds(node.path);
    const cx = b.minX + (b.maxX - b.minX) / 2;
    const cy = b.minY + (b.maxY - b.minY) / 2;
    const deg = (node.rotation * 180) / Math.PI;
    attrs.push(`transform="rotate(${trimNumber(deg)} ${trimNumber(cx)} ${trimNumber(cy)})"`);
  }
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  const metaEls = metaElementsXml(node.meta, namespaces);
  if (metaEls) {
    return `<path ${attrs.join(' ')}${metaAttrs}>${metaEls}</path>`;
  }
  return `<path ${attrs.join(' ')}${metaAttrs}/>`;
}

function paintAttrs(
  paint: SvgPaint,
  name: 'fill' | 'stroke',
  registry: PaintServerRegistry,
): string[] {
  if (paint.kind === 'none') return [`${name}="none"`];
  if (paint.kind === 'solid') {
    const out = [`${name}="${paint.color}"`];
    if (paint.opacity != null && paint.opacity !== 1) {
      out.push(`${name}-opacity="${trimNumber(paint.opacity)}"`);
    }
    return out;
  }
  // gradient
  const id = registry.register(paint.paint);
  return [`${name}="url(#${id})"`];
}

/**
 * Attributes for a kit `Stroke` — the shape text carries, whose `paint` is a
 * `FillStyle` rather than an `SvgPaint`. Text strokes ride inside
 * `TextStyle` / `StyledRun` rather than as a node-level `SvgStroke`, because
 * that is where the kit's text model puts them.
 *
 * Absent, or zero-width, emits nothing at all: unstroked text should not
 * carry a `stroke` attribute, and SVG's own default (`none`) already says so.
 */
function coreStrokeAttrs(stroke: Stroke | undefined, registry: PaintServerRegistry): string[] {
  if (!stroke) return [];
  const width = stroke.width ?? 1;
  if (!(width > 0)) return [];
  const attrs: string[] = [];
  if ('color' in stroke.paint) {
    attrs.push(`stroke="${stroke.paint.color}"`);
    if (stroke.paint.opacity != null && stroke.paint.opacity !== 1) {
      attrs.push(`stroke-opacity="${trimNumber(stroke.paint.opacity)}"`);
    }
  } else {
    attrs.push(`stroke="url(#${registry.register(stroke.paint)})"`);
  }
  attrs.push(`stroke-width="${trimNumber(width)}"`);
  if (stroke.cap) attrs.push(`stroke-linecap="${stroke.cap}"`);
  if (stroke.join) attrs.push(`stroke-linejoin="${stroke.join}"`);
  if (stroke.dash && stroke.dash.length > 0) {
    attrs.push(`stroke-dasharray="${stroke.dash.map(trimNumber).join(' ')}"`);
  }
  if (stroke.miterLimit != null) attrs.push(`stroke-miterlimit="${trimNumber(stroke.miterLimit)}"`);
  return attrs;
}

function strokeAttrsFor(stroke: SvgStroke, registry: PaintServerRegistry): string[] {
  const attrs = paintAttrs(stroke.paint, 'stroke', registry);
  attrs.push(`stroke-width="${trimNumber(stroke.width)}"`);
  if (stroke.opacity != null && stroke.opacity !== 1) {
    attrs.push(`stroke-opacity="${trimNumber(stroke.opacity)}"`);
  }
  if (stroke.cap) {
    attrs.push(`stroke-linecap="${stroke.cap}"`);
  }
  if (stroke.join) {
    attrs.push(`stroke-linejoin="${stroke.join}"`);
  }
  if (stroke.dash && stroke.dash.length > 0) {
    attrs.push(`stroke-dasharray="${stroke.dash.map(trimNumber).join(' ')}"`);
  }
  if (stroke.miterLimit != null) {
    attrs.push(`stroke-miterlimit="${trimNumber(stroke.miterLimit)}"`);
  }
  return attrs;
}

function computeBounds(nodes: SvgNode[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (n: SvgNode): void => {
    if (n.kind === 'group') {
      n.children.forEach(visit);
      return;
    }
    const b = n.kind === 'text'
      ? { minX: n.x, minY: n.y, maxX: n.x + n.width, maxY: n.y + n.height }
      : pathBounds(n.path);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  };
  nodes.forEach(visit);
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Emit a `<text>` element. Uses `dominant-baseline="text-before-edge"` so
 * the `y` attribute matches weasel's top-of-box pose; stashes the explicit
 * width/height (which native SVG text doesn't model) in `data-weasel-*`
 * attributes so they round-trip through the parser losslessly.
 */
function textXml(node: SvgTextNode, registry: PaintServerRegistry, namespaces: Record<string, string>): string {
  const attrs: string[] = [
    `x="${trimNumber(node.x)}"`,
    `y="${trimNumber(node.y)}"`,
    `dominant-baseline="text-before-edge"`,
    `data-weasel-width="${trimNumber(node.width)}"`,
    `data-weasel-height="${trimNumber(node.height)}"`,
  ];

  const style = node.style;
  if (style?.fontSize != null) attrs.push(`font-size="${trimNumber(style.fontSize)}"`);
  if (style?.fontFamily) attrs.push(`font-family="${escapeAttr(style.fontFamily)}"`);
  if (style?.fontWeight != null) attrs.push(`font-weight="${String(style.fontWeight)}"`);
  if (style?.fontStyle && style.fontStyle !== 'normal') attrs.push(`font-style="${style.fontStyle}"`);
  if (style?.align && style.align !== 'left') {
    const anchor = style.align === 'center' ? 'middle' : 'end';
    attrs.push(`text-anchor="${anchor}"`);
  }
  if (style?.letterSpacing != null && style.letterSpacing !== 0) {
    attrs.push(`letter-spacing="${trimNumber(style.letterSpacing)}"`);
  }
  const decoration = textDecorationValue(style?.underline, style?.strikethrough);
  if (decoration) attrs.push(`text-decoration="${decoration}"`);
  // Note: `lineHeight` is NOT emitted here. The bridge layer (svgInterop)
  // lifts it into `meta.wd.attrs['line-height']`, which `metaAttrsXml`
  // below emits as `wd:line-height="..."`. There is no compat write of
  // `data-weasel-line-height` — per the SVG-native plan's Migration section,
  // no installed base exists to compat against.
  if (style?.fill) {
    if ('color' in style.fill) {
      attrs.push(`fill="${style.fill.color}"`);
      if (style.fill.opacity != null && style.fill.opacity !== 1) {
        attrs.push(`fill-opacity="${trimNumber(style.fill.opacity)}"`);
      }
    } else {
      const id = registry.register(style.fill);
      attrs.push(`fill="url(#${id})"`);
    }
  }
  for (const a of coreStrokeAttrs(style?.stroke, registry)) attrs.push(a);
  if (node.opacity != null && node.opacity !== 1) {
    attrs.push(`opacity="${trimNumber(node.opacity)}"`);
  }
  if (node.rotation != null && node.rotation !== 0) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const deg = (node.rotation * 180) / Math.PI;
    attrs.push(`transform="rotate(${trimNumber(deg)} ${trimNumber(cx)} ${trimNumber(cy)})"`);
  }

  const body = node.runs && node.runs.length > 0
    ? node.runs.map((r) => runXml(r, registry)).join('')
    : escapeText(node.text);
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  const metaEls = metaElementsXml(node.meta, namespaces);
  return `<text ${attrs.join(' ')}${metaAttrs}>${body}${metaEls}</text>`;
}

function runXml(run: import('@weasel-js/core').StyledRun, registry: PaintServerRegistry): string {
  const attrs: string[] = [];
  if (run.bold) attrs.push(`font-weight="700"`);
  if (run.italic) attrs.push(`font-style="italic"`);
  if (run.fontFamily) attrs.push(`font-family="${escapeAttr(run.fontFamily)}"`);
  if (run.fontSize != null) attrs.push(`font-size="${trimNumber(run.fontSize)}"`);
  // Unlike the node-level style guard above, a run-level `0` is a meaningful
  // *override* (distinct from "inherit the node's letterSpacing") per the
  // runs model's additive-flags contract — emit it whenever it's set.
  if (run.letterSpacing != null) {
    attrs.push(`letter-spacing="${trimNumber(run.letterSpacing)}"`);
  }
  const runDecoration = textDecorationValue(run.underline, run.strikethrough);
  if (runDecoration) attrs.push(`text-decoration="${runDecoration}"`);
  if (run.fill) {
    if ('color' in run.fill) {
      attrs.push(`fill="${run.fill.color}"`);
    } else {
      const id = registry.register(run.fill);
      attrs.push(`fill="url(#${id})"`);
    }
  }
  for (const a of coreStrokeAttrs(run.stroke, registry)) attrs.push(a);
  const head = attrs.length > 0 ? `<tspan ${attrs.join(' ')}>` : '<tspan>';
  return `${head}${escapeText(run.text)}</tspan>`;
}

/**
 * Combine the two decoration flags into an SVG `text-decoration` value —
 * `"underline line-through"` when both are set, a single token when only
 * one is, or `null` (omit the attribute) when neither is set.
 */
function textDecorationValue(underline: boolean | undefined, strikethrough: boolean | undefined): string | null {
  const tokens: string[] = [];
  if (underline) tokens.push('underline');
  if (strikethrough) tokens.push('line-through');
  return tokens.length > 0 ? tokens.join(' ') : null;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Silence unused-import warnings when the runs export gets tree-shaken.
void runsToPlainText;

function pathBounds(path: Path): { minX: number; minY: number; maxX: number; maxY: number } {
  if (path.kind === 'rect') {
    return {
      minX: path.x, minY: path.y,
      maxX: path.x + path.width, maxY: path.y + path.height,
    };
  }
  const b = boundsOfPath(path);
  return { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height };
}

