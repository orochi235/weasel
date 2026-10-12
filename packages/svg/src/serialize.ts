/**
 * Serialize a `SvgNode[]` tree to an SVG document string. Every path leaf is
 * emitted as a `<path>`, even shapes that started as `<rect>` etc.
 */

import { escapeAttr, escapeText } from './xmlEscape';
import type { FontRequest, Stroke, StrokeAlign } from '@weasel-js/core';
import { resolveRunFace, resolveScreenLength, resolveTextStyle, scriptMetricsFor } from '@weasel-js/core';
import type {
  NamespaceMeta, NamespacedElement, SerializeOptions, SvgGroupNode,
  SvgNode, SvgPaint, SvgPathNode, SvgStroke, SvgTextNode, SvgImageNode,
  ScreenLength,
} from './types';
import { serializePathD } from './path-serializer';
import { formatMatrix, trimNumber } from './transform';
import { PaintServerRegistry, WEASEL_NS, WEASEL_NS_PREFIX } from './gradients';
import { anchorOffset, svgDirection } from './textAnchor';
import { boxTransformAttr } from './placeBox';
import { computeBounds, pathBounds } from './serializeBounds';

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

export function registerPaintServers(nodes: readonly SvgNode[], registry: PaintServerRegistry): void {
  for (const n of nodes) {
    if (n.kind === 'group') {
      if (n.clip) registry.clipId(n.clip);
      registerPaintServers(n.children, registry);
    } else if (n.kind === 'path') {
      if (n.fill.kind === 'gradient') registry.register(n.fill.paint);
      if (n.stroke && n.stroke.paint.kind === 'gradient') registry.register(n.stroke.paint.paint);
      registerMarkers(n.stroke, registry);
    } else if (n.kind === 'text') {
      // This pre-pass is load-bearing: `<defs>` is emitted before the body, so
      // a paint first seen while writing an element would be referenced by an
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

/** Register one text paint if it is a paint server rather than a color. */
function registerTextPaint(
  paint: import('@weasel-js/core').FillStyle | null | undefined,
  registry: PaintServerRegistry,
): void {
  if (paint && !('color' in paint)) registry.register(paint);
}

/** Mint a `<defs>` id for every marker a stroke names, before the body is
 *  written — same reason as the paint pre-pass above. */
function registerMarkers(stroke: Pick<Stroke, 'markerStart' | 'markerMid' | 'markerEnd'> | undefined, registry: PaintServerRegistry): void {
  if (!stroke) return;
  for (const ref of [stroke.markerStart, stroke.markerMid, stroke.markerEnd]) {
    if (ref !== undefined) registry.markerId(ref);
  }
}

type Warn = (message: string) => void;

function nodeXml(
  node: SvgNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn,
): string {
  const xml = kindXml(node, registry, namespaces, warn);
  return node.hidden ? xml.replace(/^<[\w:]+/, (open) => `${open} display="none"`) : xml;
}

function kindXml(
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
  // Only when it diverges from SVG's default ('nonzero').
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
  const out = [`${name}="${paint.kind === 'solid' ? escapeAttr(paint.color) : registry.ref(paint.paint)}"`];
  if (includeOpacity) out.push(...opacityAttr(`${name}-opacity`, svgPaintOpacity(paint)));
  return out;
}

/** The opacity an `SvgPaint` carries, whichever kind holds it. */
function svgPaintOpacity(paint: SvgPaint): number | undefined {
  if (paint.kind === 'solid') return paint.opacity;
  return paint.kind === 'gradient' ? paint.paint.opacity : undefined;
}

/** `name="v"`, or nothing when `v` is absent or fully opaque. */
function opacityAttr(name: string, v: number | undefined): string[] {
  return v != null && v !== 1 ? [`${name}="${trimNumber(v)}"`] : [];
}

/**
 * `stroke-width`, plus `vector-effect="non-scaling-stroke"` when the width is
 * in screen pixels: the number goes out unresolved, since resolving it would
 * bake a single zoom level into the document.
 */
function strokeWidthAttrs(width: ScreenLength): string[] {
  if (typeof width === 'number') return [`stroke-width="${trimNumber(width)}"`];
  return [`stroke-width="${trimNumber(width.px)}"`, 'vector-effect="non-scaling-stroke"'];
}

/**
 * Attributes for a kit `Stroke` — the shape text carries, whose `paint` is a
 * `FillStyle` rather than an `SvgPaint`. Absent, unpainted, or zero-width
 * emits nothing at all.
 */
function coreStrokeAttrs(stroke: Stroke | undefined, registry: PaintServerRegistry, warn: Warn): string[] {
  const paint = stroke?.paint;
  if (!stroke || !paint) return [];
  const width = stroke.width ?? 1;
  if (!((typeof width === 'object' ? width.px : width) > 0)) return [];
  warnStrokeAlign(stroke.align, warn);
  const attrs: string[] = [`stroke="${'color' in paint ? escapeAttr(paint.color) : registry.ref(paint)}"`];
  attrs.push(...opacityAttr('stroke-opacity', paint.opacity));
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
    const id = registry.markerId(ref);
    if (id === undefined) continue;
    attrs.push(`${attr}="url(#${id})"`);
  }
  return attrs;
}

function strokeAttrsFor(stroke: SvgStroke, registry: PaintServerRegistry, warn: Warn): string[] {
  warnStrokeAlign(stroke.align, warn);
  // `SvgStroke.opacity` and the paint's own `opacity` are two models of one
  // SVG attribute, and parse fills in both. Emitting each would write
  // `stroke-opacity` twice, which is not well-formed XML.
  const attrs = paintAttrs(stroke.paint, 'stroke', registry, false);
  attrs.push(...strokeWidthAttrs(stroke.width));
  attrs.push(...opacityAttr('stroke-opacity', stroke.opacity ?? svgPaintOpacity(stroke.paint)));
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
 * Emit a `<text>` element. `x` is the `text-anchor` point: the box's left
 * edge, center, or right edge as its alignment resolves.
 * `dominant-baseline="text-before-edge"` makes `y` the top of the box, and
 * the width and height, which SVG text doesn't model, go in `data-weasel-*`.
 */
function textXml(
  node: SvgTextNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn,
): string {
  const attrs: string[] = [
    `x="${trimNumber(node.x + anchorOffset(node.style, node.width, node.text))}"`,
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
  if (style?.fontWeight != null) attrs.push(`font-weight="${escapeAttr(String(style.fontWeight))}"`);
  if (style?.fontStyle && style.fontStyle !== 'normal') attrs.push(`font-style="${style.fontStyle}"`);
  if (style?.fontVariantCaps === 'small-caps') attrs.push('font-variant="small-caps"');
  const direction = svgDirection(style, node.text);
  // A stated `ltr` is written too: absent reads back as the text's own direction.
  if (direction === 'rtl' || style?.direction === 'ltr') attrs.push(`direction="${direction}"`);
  if (style?.align != null || direction === 'rtl') {
    // `text-anchor` is reading-order relative in SVG exactly as `start` / `end`
    // are here, so only the absolute pair has to be turned into an edge the
    // reader resolves the same way.
    const align = style?.align ?? 'left';
    // SVG text does not wrap, so every line written closes its paragraph and
    // a justified node draws at its start edge. `data-weasel-align` keeps the
    // justification for weasel's own reader.
    const anchor = align === 'center' ? 'middle'
      : align === 'start' || align === 'justify' ? 'start'
      : align === 'end' ? 'end'
      : (align === 'left') === (direction === 'ltr') ? 'start' : 'end';
    if (anchor !== 'start') attrs.push(`text-anchor="${anchor}"`);
    if (align === 'justify') attrs.push('data-weasel-align="justify"');
  }
  if (style?.letterSpacing != null && style.letterSpacing !== 0) {
    attrs.push(`letter-spacing="${trimNumber(resolveScreenLength(style.letterSpacing, 1))}"`);
  }
  const decoration = textDecorationValue(style?.underline, style?.strikethrough, style?.overline);
  if (decoration) attrs.push(`text-decoration="${decoration}"`);
  if (style?.script) attrs.push(`baseline-shift="${style.script}"`);
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
  if (style?.tabSize != null) attrs.push(`data-weasel-tab-size="${trimNumber(style.tabSize)}"`);
  if (node.verticalAlign && node.verticalAlign !== 'top') {
    attrs.push(`data-weasel-vertical-align="${node.verticalAlign}"`);
    warn(`text aligned to the ${node.verticalAlign} of its box is written top-aligned: SVG text has`
      + ' no box, so other readers draw it at the top (weasel reads the alignment back)');
  }
  // `lineHeight` is NOT emitted here: a caller that wants it carries it in `meta`.
  if (node.fill === null) {
    attrs.push('fill="none"');
  } else if (node.fill) {
    attrs.push(`fill="${'color' in node.fill ? escapeAttr(node.fill.color) : registry.ref(node.fill)}"`);
    attrs.push(...opacityAttr('fill-opacity', node.fill.opacity));
  }
  for (const a of coreStrokeAttrs(node.stroke, registry, warn)) attrs.push(a);
  if (node.opacity != null && node.opacity !== 1) {
    attrs.push(`opacity="${trimNumber(node.opacity)}"`);
  }
  const frame = boxTransformAttr(node);
  if (frame) attrs.push(frame);

  const body = node.runs && node.runs.length > 0
    ? node.runs.map((r) => runXml(r, style, registry, warn)).join('')
    : escapeText(node.text);
  const metaAttrs = metaAttrsXml(node.meta, namespaces);
  const metaEls = metaElementsXml(node.meta, namespaces);
  return `<text ${attrs.join(' ')}${metaAttrs}>${body}${metaEls}</text>`;
}

/**
 * The face whose metrics size `run`'s script, for a run that overrode only
 * the rise and so must spell the preset's size out. `undefined` for every
 * other run.
 */
export function scriptSizeFace(
  run: import('@weasel-js/core').StyledRun, style: SvgTextNode['style'],
): Required<FontRequest> | undefined {
  if (run.script == null || run.baselineShift == null) return undefined;
  const face = resolveRunFace(run, resolveTextStyle(style));
  return { family: face.fontFamily, weight: face.fontWeight, style: face.fontStyle };
}

function runXml(
  run: import('@weasel-js/core').StyledRun,
  style: SvgTextNode['style'],
  registry: PaintServerRegistry,
  warn: Warn,
): string {
  const attrs: string[] = [];
  if (run.fontWeight != null) attrs.push(`font-weight="${run.fontWeight}"`);
  else if (run.bold) attrs.push(`font-weight="700"`);
  if (run.italic) attrs.push(`font-style="italic"`);
  // `normal` included: on a run it overrides small caps the node passes down.
  if (run.fontVariantCaps) attrs.push(`font-variant="${run.fontVariantCaps}"`);
  if (run.fontFamily) attrs.push(`font-family="${escapeAttr(run.fontFamily)}"`);
  // A percentage `font-size` is relative to the parent's, which is what
  // `fontScale` means; an absolute `fontSize` wins over it.
  //
  // `baseline-shift="super"` carries the preset's *size* as well as its rise,
  // so a run that overrode only the rise must spell the size out, or the
  // superscript comes back full-size at a raised baseline.
  const face = scriptSizeFace(run, style);
  const presetScale = face && run.script
    ? scriptMetricsFor(face.family, face.weight, face.style)[run.script].size
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
  // Unlike at node level, a run-level `0` is an override, not "inherit the
  // node's letterSpacing", so it is emitted whenever set.
  if (run.letterSpacing != null) {
    attrs.push(`letter-spacing="${trimNumber(resolveScreenLength(run.letterSpacing, 1))}"`);
  }
  const runDecoration = textDecorationValue(run.underline, run.strikethrough, run.overline);
  if (runDecoration) attrs.push(`text-decoration="${runDecoration}"`);
  if (run.fill === null) attrs.push('fill="none"');
  else if (run.fill) {
    if ('color' in run.fill) {
      attrs.push(`fill="${escapeAttr(run.fill.color)}"`);
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

/** The flags as an SVG `text-decoration` value, or `null` when none is set. */

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
