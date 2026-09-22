/**
 * Serialize a `SvgNode[]` tree to an SVG document string. Every leaf is
 * emitted as a `<path>` (even shapes that started as `<rect>` etc.) —
 * lossless geometry round-trip beats round-tripping the element-kind
 * label. Gradient paints are gathered into a single `<defs>` block.
 */

import type { Path, Stroke, StrokeAlign } from '@weasel-js/core';
import { boundsOfPath, resolveScreenLength, SCRIPT_METRICS } from '@weasel-js/core';
import type {
  Matrix, NamespaceMeta, NamespacedElement, SerializeOptions, SvgGroupNode,
  SvgNode, SvgPaint, SvgPathNode, SvgStroke, SvgTextNode, SvgImageNode,
  ScreenLength,
} from './types';
import { IDENTITY_MATRIX } from './types';
import { serializePathD } from './path-serializer';
import { formatMatrix, multiply, trimNumber } from './transform';
import { PaintServerRegistry, WEASEL_NS, WEASEL_NS_PREFIX } from './gradients';
import { anchorOffset } from './textAnchor';

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
  // Declared before the caller's namespaces and only when something needs it,
  // so a document of ordinary paints carries no trace of it. The paint pre-pass
  // above has already seen every paint, so this answer is final.
  if (registry.usesPrivateNamespace() && namespaces[WEASEL_NS_PREFIX] == null) {
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
  // Once per message: a hundred inner-aligned strokes are one fact.
  const said = new Set<string>();
  const warn: Warn = (m) => {
    if (!opts.onWarn || said.has(m)) return;
    said.add(m);
    opts.onWarn(m);
  };
  const bodyXml = nodes.map((n) => nodeXml(n, registry, namespaces, warn)).join('');

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
      if (n.clip) registry.clipId(n.clip);
      registerPaintServers(n.children, registry);
    } else if (n.kind === 'path') {
      if (n.fill.kind === 'gradient') registry.register(n.fill.paint);
      if (n.stroke && n.stroke.paint.kind === 'gradient') registry.register(n.stroke.paint.paint);
      registerMarkers(n.stroke, registry);
    } else if (n.kind === 'text') {
      // Text paints flow through `style` / `runs` rather than a top-level
      // SvgPaint, so register direct FillStyle references when present. This
      // pre-pass is load-bearing: `<defs>` is emitted before the body, so a
      // paint first seen while writing an element would be referenced by an
      // id that no definition backs.
      registerTextPaint(n.fill, registry);
      registerTextPaint(n.stroke?.paint, registry);
      registerMarkers(n.stroke, registry);
      for (const run of n.runs ?? []) {
        registerTextPaint(run.fill, registry);
        registerTextPaint(run.stroke?.paint, registry);
      }
    }
  }
}

/** Register one text paint if it is a paint server rather than a colour. */
function registerTextPaint(
  paint: import('@weasel-js/core').FillStyle | null | undefined,
  registry: PaintServerRegistry,
): void {
  if (paint && !('color' in paint)) registry.register(paint);
}

/** A marker reference in either shape — `SvgStroke` stores a bare key, the kit
 *  `Stroke` stores a `MarkerRef`. */
function markerKeyOfRef(ref: unknown): string | undefined {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && 'key' in ref) return String((ref as { key: string }).key);
  return undefined;
}

/** Mint a `<defs>` id for every marker a stroke names, before the body is
 *  written — same reason as the paint pre-pass above. */
function registerMarkers(
  stroke: { markerStart?: unknown; markerMid?: unknown; markerEnd?: unknown } | undefined,
  registry: PaintServerRegistry,
): void {
  if (!stroke) return;
  for (const ref of [stroke.markerStart, stroke.markerMid, stroke.markerEnd]) {
    const key = markerKeyOfRef(ref);
    if (key) registry.markerId(key);
  }
}

type Warn = (message: string) => void;

function nodeXml(
  node: SvgNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn,
): string {
  if (node.kind === 'group') return groupXml(node, registry, namespaces, warn);
  if (node.kind === 'text') return textXml(node, registry, namespaces, warn);
  if (node.kind === 'image') return imageXml(node, namespaces);
  return pathXml(node, registry, namespaces, warn);
}

/** SVG 1.1 has no stroke alignment; SVG 2's `stroke-alignment` never shipped
 *  in a browser. */
function warnStrokeAlign(align: StrokeAlign | undefined, warn: Warn): void {
  if (align && align !== 'center') {
    warn(`a stroke aligned "${align}" of its edge is written centered: SVG has no stroke alignment`);
  }
}

/**
 * Emit an `<image>`. `preserveAspectRatio="none"` is unconditional: the node
 * carries a literal box and nothing else, so letting a viewer letterbox it
 * would place the pixels somewhere the model never said.
 *
 * A source rect or a flip takes the cropped form described on `SvgImageNode`.
 * The nested `<svg>` cannot carry the rotation itself — SVG 1.1 gives it no
 * `transform` — so the rotation, opacity and meta go on the wrapping `<g>`.
 */
function imageXml(node: SvgImageNode, namespaces: Record<string, string>): string {
  const box = `x="${trimNumber(node.x)}" y="${trimNumber(node.y)}"`
    + ` width="${trimNumber(node.width)}" height="${trimNumber(node.height)}"`;
  const outer: string[] = [];
  if (node.opacity != null && node.opacity !== 1) {
    outer.push(`opacity="${trimNumber(node.opacity)}"`);
  }
  if (node.rotation != null && node.rotation !== 0) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const deg = (node.rotation * 180) / Math.PI;
    outer.push(`transform="rotate(${trimNumber(deg)} ${trimNumber(cx)} ${trimNumber(cy)})"`);
  }
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
  node: SvgGroupNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn,
): string {
  const attrs: string[] = [];
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
  // `metaAttrs` already starts with a leading space (or is empty), so we
  // can splice it after the existing attr list without extra logic.
  const head = attrs.length > 0
    ? `<g ${attrs.join(' ')}${metaAttrs}>`
    : `<g${metaAttrs}>`;
  const body = node.children.map((c) => nodeXml(c, registry, namespaces, warn)).join('');
  return `${head}${body}${metaElementsXml(node.meta, namespaces)}</g>`;
}

function pathXml(
  node: SvgPathNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn,
): string {
  const attrs: string[] = [`d="${serializePathD(node.path)}"`];
  const fillAttrs = paintAttrs(node.fill, 'fill', registry);
  for (const a of fillAttrs) attrs.push(a);
  // Emit fill-rule only when it diverges from SVG's default ('nonzero').
  // RectPath has no fillRule field — only PolygonPath carries one.
  if (node.path.kind === 'polygon' && node.path.fillRule === 'evenodd') {
    attrs.push(`fill-rule="evenodd"`);
  }
  if (node.stroke) {
    const strokeAttrs = strokeAttrsFor(node.stroke, registry, warn);
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
  includeOpacity = true,
): string[] {
  if (paint.kind === 'none') return [`${name}="none"`];
  if (paint.kind === 'solid') {
    const out = [`${name}="${paint.color}"`];
    if (includeOpacity && paint.opacity != null && paint.opacity !== 1) {
      out.push(`${name}-opacity="${trimNumber(paint.opacity)}"`);
    }
    return out;
  }
  // gradient
  return [`${name}="${registry.ref(paint.paint)}"`];
}

/**
 * Attributes for a kit `Stroke` — the shape text carries, whose `paint` is a
 * `FillStyle` rather than an `SvgPaint`. Text strokes ride inside
 * `TextStyle` / `StyledRun` rather than as a node-level `SvgStroke`, because
 * that is where the kit's text model puts them.
 *
 * Absent, unpainted, or zero-width emits nothing at all: unstroked text should
 * not carry a `stroke` attribute, and SVG's own default (`none`) already says
 * so.
 */
/**
 * `stroke-width`, plus `vector-effect` when the width is in screen pixels.
 *
 * A `{ px }` width means "this thickness once rendered, whatever the view is
 * doing", which is exactly what `non-scaling-stroke` says — so the number goes
 * out unresolved and the attribute carries the unit. There is no accumulated
 * transform scale here to resolve it against, and picking one would bake a
 * single zoom level into the document.
 */
function strokeWidthAttrs(width: ScreenLength): string[] {
  if (typeof width === 'number') return [`stroke-width="${trimNumber(width)}"`];
  return [`stroke-width="${trimNumber(width.px)}"`, 'vector-effect="non-scaling-stroke"'];
}

function coreStrokeAttrs(stroke: Stroke | undefined, registry: PaintServerRegistry, warn: Warn): string[] {
  const paint = stroke?.paint;
  if (!stroke || !paint) return [];
  const width = stroke.width ?? 1;
  if (!((typeof width === 'object' ? width.px : width) > 0)) return [];
  warnStrokeAlign(stroke.align, warn);
  const attrs: string[] = [];
  if ('color' in paint) {
    attrs.push(`stroke="${paint.color}"`);
    if (paint.opacity != null && paint.opacity !== 1) {
      attrs.push(`stroke-opacity="${trimNumber(paint.opacity)}"`);
    }
  } else {
    attrs.push(`stroke="${registry.ref(paint)}"`);
  }
  attrs.push(...strokeWidthAttrs(width));
  if (stroke.cap) attrs.push(`stroke-linecap="${stroke.cap}"`);
  if (stroke.join) attrs.push(`stroke-linejoin="${stroke.join}"`);
  if (stroke.dash && stroke.dash.length > 0) {
    attrs.push(`stroke-dasharray="${stroke.dash.map(trimNumber).join(' ')}"`);
  }
  if (stroke.miterLimit != null) attrs.push(`stroke-miterlimit="${trimNumber(stroke.miterLimit)}"`);
  for (const [field, attr] of [
    ['markerStart', 'marker-start'],
    ['markerMid', 'marker-mid'],
    ['markerEnd', 'marker-end'],
  ] as const) {
    const ref = stroke[field];
    if (ref === undefined) continue;
    const key = typeof ref === 'string' ? ref : ref.key;
    const id = registry.markerId(key);
    if (id === undefined) continue;
    attrs.push(`${attr}="url(#${id})"`);
  }
  return attrs;
}

function strokeAttrsFor(stroke: SvgStroke, registry: PaintServerRegistry, warn: Warn): string[] {
  warnStrokeAlign(stroke.align, warn);
  // `SvgStroke.opacity` and the paint's own `opacity` are two models of one
  // SVG attribute, and parse fills in both. Emitting each would write
  // `stroke-opacity` twice, which is not well-formed XML at all.
  const attrs = paintAttrs(stroke.paint, 'stroke', registry, false);
  attrs.push(...strokeWidthAttrs(stroke.width));
  const opacity = stroke.opacity
    ?? (stroke.paint.kind === 'solid' ? stroke.paint.opacity : undefined);
  if (opacity != null && opacity !== 1) {
    attrs.push(`stroke-opacity="${trimNumber(opacity)}"`);
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
  for (const [field, attr] of [
    ['markerStart', 'marker-start'],
    ['markerMid', 'marker-mid'],
    ['markerEnd', 'marker-end'],
  ] as const) {
    const ref = stroke[field];
    if (ref === undefined) continue;
    const id = registry.markerId(ref);
    if (id === undefined) continue;
    attrs.push(`${attr}="url(#${id})"`);
  }
  return attrs;
}

/**
 * Tight bounding box around everything the tree draws, in the root's
 * coordinates — the fallback `viewBox` when the caller supplies none. A
 * node's `rotation` and a group's `transform` both move ink, so both are
 * applied here; a box taken from unrotated geometry crops the document.
 */
function computeBounds(nodes: SvgNode[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (n: SvgNode, ctm: Matrix): void => {
    if (n.kind === 'group') {
      const childCtm = n.transform ? multiply(ctm, n.transform) : ctm;
      n.children.forEach((c) => visit(c, childCtm));
      return;
    }
    const b = n.kind === 'text' || n.kind === 'image'
      ? { minX: n.x, minY: n.y, maxX: n.x + n.width, maxY: n.y + n.height }
      : pathBounds(n.path);
    const local = n.rotation ? rotateAboutCenter(ctm, b, n.rotation) : ctm;
    for (const [x, y] of corners(b)) {
      const px = local[0] * x + local[2] * y + local[4];
      const py = local[1] * x + local[3] * y + local[5];
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
  };
  nodes.forEach((n) => visit(n, IDENTITY_MATRIX));
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function corners(b: { minX: number; minY: number; maxX: number; maxY: number }): [number, number][] {
  return [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]];
}

/** `ctm` composed with the same `rotate(angle cx cy)` the element emits. */
function rotateAboutCenter(
  ctm: Matrix,
  b: { minX: number; minY: number; maxX: number; maxY: number },
  angle: number,
): Matrix {
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return multiply(ctm, [c, s, -s, c, cx - cx * c + cy * s, cy - cx * s - cy * c]);
}

/**
 * Emit a `<text>` element. `x` is the `text-anchor` point, per the SVG spec:
 * the box's left edge, center or right edge as its alignment resolves. Uses
 * `dominant-baseline="text-before-edge"` so `y` matches weasel's top-of-box
 * pose; stashes the explicit width/height (which native SVG text doesn't
 * model) in `data-weasel-*` attributes so they round-trip through the parser
 * losslessly.
 */
function textXml(
  node: SvgTextNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn,
): string {
  const attrs: string[] = [
    `x="${trimNumber(node.x + anchorOffset(node.style, node.width))}"`,
    `y="${trimNumber(node.y)}"`,
    `dominant-baseline="text-before-edge"`,
    // The runs model stores real line breaks; SVG's default whitespace
    // handling would collapse them (and any indentation) away on re-import.
    `xml:space="preserve"`,
    `data-weasel-width="${trimNumber(node.width)}"`,
    `data-weasel-height="${trimNumber(node.height)}"`,
  ];

  const style = node.style;
  // SVG user space has no camera, so a `{ px }` size writes as that many
  // user units — the reading it already has at scale 1.
  if (style?.fontSize != null) attrs.push(`font-size="${trimNumber(resolveScreenLength(style.fontSize, 1))}"`);
  if (style?.fontFamily) attrs.push(`font-family="${escapeAttr(style.fontFamily)}"`);
  if (style?.fontWeight != null) attrs.push(`font-weight="${String(style.fontWeight)}"`);
  if (style?.fontStyle && style.fontStyle !== 'normal') attrs.push(`font-style="${style.fontStyle}"`);
  const direction = style?.direction ?? 'ltr';
  if (direction === 'rtl') attrs.push('direction="rtl"');
  if (style?.align != null || direction === 'rtl') {
    // `text-anchor` is reading-order relative in SVG exactly as `start` / `end`
    // are here, so the two relative values pass straight through and only the
    // absolute pair has to be turned into an edge the reader resolves the same
    // way. Under `ltr` this collapses to what it always wrote.
    const align = style?.align ?? 'left';
    const anchor = align === 'center' ? 'middle'
      : align === 'start' ? 'start'
      : align === 'end' ? 'end'
      : (align === 'left') === (direction === 'ltr') ? 'start' : 'end';
    if (anchor !== 'start') attrs.push(`text-anchor="${anchor}"`);
  }
  if (style?.letterSpacing != null && style.letterSpacing !== 0) {
    attrs.push(`letter-spacing="${trimNumber(resolveScreenLength(style.letterSpacing, 1))}"`);
  }
  const decoration = textDecorationValue(style?.underline, style?.strikethrough, style?.overline);
  if (decoration) attrs.push(`text-decoration="${decoration}"`);
  // A CSS property rather than an SVG 1.1 presentation attribute, so it goes
  // where every CSS-aware reader looks for it.
  if (style?.textTransform && style.textTransform !== 'none') {
    attrs.push(`style="text-transform:${style.textTransform}"`);
  }
  // SVG text never wraps, so this is for weasel's own reader, beside the box
  // width it wraps at.
  if (style?.wrap) {
    attrs.push('data-weasel-wrap="true"');
    warn('text that wraps at its box width is written unwrapped: SVG text does not wrap, so other'
      + ' readers draw one line per hard break (weasel reads the wrap back)');
  }
  if (node.verticalAlign && node.verticalAlign !== 'top') {
    attrs.push(`data-weasel-vertical-align="${node.verticalAlign}"`);
    warn(`text aligned to the ${node.verticalAlign} of its box is written top-aligned: SVG text has`
      + ' no box, so other readers draw it at the top (weasel reads the alignment back)');
  }
  // Note: `lineHeight` is NOT emitted here. The bridge layer (svgInterop)
  // lifts it into `meta.wd.attrs['line-height']`, which `metaAttrsXml`
  // below emits as `wd:line-height="..."`. There is no compat write of
  // `data-weasel-line-height` — per the SVG-native plan's Migration section,
  // no installed base exists to compat against.
  if (node.fill === null) {
    attrs.push('fill="none"');
  } else if (node.fill) {
    if ('color' in node.fill) {
      attrs.push(`fill="${node.fill.color}"`);
      if (node.fill.opacity != null && node.fill.opacity !== 1) {
        attrs.push(`fill-opacity="${trimNumber(node.fill.opacity)}"`);
      }
    } else {
      attrs.push(`fill="${registry.ref(node.fill)}"`);
    }
  }
  for (const a of coreStrokeAttrs(node.stroke, registry, warn)) attrs.push(a);
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
    ? node.runs.map((r) => runXml(r, registry, warn)).join('')
    : escapeText(node.text);
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  const metaEls = metaElementsXml(node.meta, namespaces);
  return `<text ${attrs.join(' ')}${metaAttrs}>${body}${metaEls}</text>`;
}

function runXml(run: import('@weasel-js/core').StyledRun, registry: PaintServerRegistry, warn: Warn): string {
  const attrs: string[] = [];
  if (run.bold) attrs.push(`font-weight="700"`);
  if (run.italic) attrs.push(`font-style="italic"`);
  if (run.fontFamily) attrs.push(`font-family="${escapeAttr(run.fontFamily)}"`);
  // A percentage `font-size` is relative to the parent's, which is what
  // `fontScale` means; an absolute `fontSize` wins over it here as it does in
  // the runs model.
  //
  // `baseline-shift="super"` carries the preset's *size* as well as its rise,
  // so a run that overrode only the rise has no keyword left to say the size
  // with and must spell it out — without this the superscript comes back
  // full-size at a raised baseline.
  const presetScale = run.script != null && run.baselineShift != null
    ? SCRIPT_METRICS[run.script].size
    : undefined;
  const scale = run.fontScale ?? presetScale;
  if (run.fontSize != null) attrs.push(`font-size="${trimNumber(resolveScreenLength(run.fontSize, 1))}"`);
  else if (scale != null) attrs.push(`font-size="${trimNumber(scale * 100)}%"`);
  // Same story for `baseline-shift`: an SVG percentage resolves against the
  // parent's font size, which is the unit `baselineShift` is already in.
  if (run.baselineShift != null) {
    attrs.push(`baseline-shift="${trimNumber(run.baselineShift * 100)}%"`);
  } else if (run.script) {
    attrs.push(`baseline-shift="${run.script}"`);
  }
  // Unlike the node-level style guard above, a run-level `0` is a meaningful
  // *override* (distinct from "inherit the node's letterSpacing") per the
  // runs model's additive-flags contract — emit it whenever it's set.
  if (run.letterSpacing != null) {
    attrs.push(`letter-spacing="${trimNumber(resolveScreenLength(run.letterSpacing, 1))}"`);
  }
  const runDecoration = textDecorationValue(run.underline, run.strikethrough, run.overline);
  if (runDecoration) attrs.push(`text-decoration="${runDecoration}"`);
  if (run.fill) {
    if ('color' in run.fill) {
      attrs.push(`fill="${run.fill.color}"`);
    } else {
      attrs.push(`fill="${registry.ref(run.fill)}"`);
    }
  }
  for (const a of coreStrokeAttrs(run.stroke, registry, warn)) attrs.push(a);
  // `none` included: on a run it overrides a transform the node would pass down.
  if (run.textTransform) attrs.push(`style="text-transform:${run.textTransform}"`);
  const head = attrs.length > 0 ? `<tspan ${attrs.join(' ')}>` : '<tspan>';
  return `${head}${escapeText(run.text)}</tspan>`;
}

/**
 * Combine the decoration flags into an SVG `text-decoration` value —
 * `"underline line-through"` when both are set, a single token when only
 * one is, or `null` (omit the attribute) when none is set.
 */
function textDecorationValue(
  underline: boolean | undefined,
  strikethrough: boolean | undefined,
  overline: boolean | undefined,
): string | null {
  const tokens: string[] = [];
  if (underline) tokens.push('underline');
  if (strikethrough) tokens.push('line-through');
  if (overline) tokens.push('overline');
  return tokens.length > 0 ? tokens.join(' ') : null;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

