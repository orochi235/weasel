/**
 * Parse an SVG document string into a `SvgNode[]` tree. Walks the SVG
 * DOM (via the platform's `DOMParser` — jsdom in tests, the browser at
 * runtime) and lowers each supported element to weasel-native shapes.
 *
 * Transforms are pushed onto a matrix stack and collapsed into leaf
 * geometry at the moment a leaf is created, so the output tree never
 * carries `transform` data — even on `<g>` nodes.
 */

import type { Path } from '@orochi235/weasel';
import {
  rectElementToPath, circleToPath, ellipseToPath, lineToPath,
  parsePoints, polylineToPath, polygonToPath,
} from './shapes';
import { parsePathD } from './path-parser';
import { transformPath } from './shapes';
import type {
  Matrix, NamespaceMeta, NamespacedElement, ParseOptions, ParseResult,
  SvgNode, SvgPaint, SvgPathNode, SvgStroke, SvgTextNode,
} from './types';
import type { StyledRun, TextStyle, Paint } from '@orochi235/weasel';
import { multiply, parseTransform } from './transform';
import { IDENTITY_MATRIX } from './types';
import { parsePaintAttr } from './color';
import { collectGradients, type GradientTable } from './gradients';

/** Element tags we accept and lower; anything else triggers a warning. */
const SUPPORTED_LEAF_TAGS = new Set([
  'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
]);

const SUPPORTED_GROUP_TAGS = new Set(['g', 'svg']);

const IGNORED_TAGS = new Set(['defs', 'linearGradient', 'radialGradient', 'title', 'desc', 'metadata']);

/**
 * Public entry point: parse an SVG document string. Errors during DOM
 * parsing produce a `ParseResult` with an empty `nodes` array and a
 * warning describing the issue, rather than throwing.
 */
export function parseSvg(svg: string, opts: ParseOptions = {}): ParseResult {
  const warnings: string[] = [];
  const onWarn = (m: string): void => { warnings.push(m); };

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  } catch (e) {
    return { nodes: [], warnings: [`failed to parse SVG: ${(e as Error).message}`] };
  }
  const errEl = doc.getElementsByTagName('parsererror')[0];
  if (errEl) {
    return { nodes: [], warnings: [`SVG parse error: ${errEl.textContent ?? 'unknown'}`] };
  }
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') {
    return { nodes: [], warnings: ['root element is not <svg>'] };
  }

  const namespaces = opts.namespaces ?? {};
  // Build a URI → prefix index for fast lookup during traversal.
  const uriToPrefix = new Map<string, string>();
  for (const [prefix, uri] of Object.entries(namespaces)) {
    uriToPrefix.set(uri, prefix);
  }

  const documentMeta = collectDocumentMeta(root, uriToPrefix);

  const gradients = collectGradients(root, onWarn);
  const nodes = parseChildren(root, IDENTITY_MATRIX, gradients, onWarn, uriToPrefix);

  const result: ParseResult = { nodes, warnings };
  if (documentMeta) result.documentMeta = documentMeta;
  const viewBox = parseViewBoxAttr(root.getAttribute('viewBox'));
  if (viewBox) result.viewBox = viewBox;
  const widthAttr = root.getAttribute('width');
  if (widthAttr != null) {
    const n = parseFloat(widthAttr);
    if (Number.isFinite(n)) result.width = n;
  }
  const heightAttr = root.getAttribute('height');
  if (heightAttr != null) {
    const n = parseFloat(heightAttr);
    if (Number.isFinite(n)) result.height = n;
  }
  // First direct-child <title> wins. Per SVG spec only one is meaningful.
  for (let i = 0; i < root.children.length; i++) {
    const c = root.children[i];
    if (c.tagName.toLowerCase() === 'title') {
      result.title = c.textContent ?? '';
      break;
    }
  }
  return result;
}

/**
 * Parse an SVG `viewBox="x y width height"` attribute. Returns undefined
 * on null/empty/malformed input. Numbers may be separated by whitespace
 * and/or commas (SVG spec).
 */
function parseViewBoxAttr(
  raw: string | null,
): { x: number; y: number; width: number; height: number } | undefined {
  if (raw == null) return undefined;
  const parts = raw.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 4) return undefined;
  const nums = parts.map(parseFloat);
  if (nums.some((n) => !Number.isFinite(n))) return undefined;
  return { x: nums[0], y: nums[1], width: nums[2], height: nums[3] };
}

function collectDocumentMeta(
  root: Element,
  uriToPrefix: Map<string, string>,
): NamespaceMeta | undefined {
  if (uriToPrefix.size === 0) return undefined;
  const meta: NamespaceMeta = {};

  // Root-level namespaced attributes.
  for (let i = 0; i < root.attributes.length; i++) {
    const a = root.attributes[i];
    if (!a.namespaceURI) continue;
    const prefix = uriToPrefix.get(a.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    (bucket.attrs ??= {})[a.localName] = a.value;
  }

  // Root-level namespaced child elements. The body of these is collected
  // recursively as a generic XML-element tree; geometry inside them is NOT
  // promoted to SvgNodes (that's the consumer's job if they want it).
  for (let i = 0; i < root.children.length; i++) {
    const c = root.children[i];
    if (!c.namespaceURI) continue;
    const prefix = uriToPrefix.get(c.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    const elements = (bucket.elements ??= {});
    const list = (elements[c.localName] ??= []);
    list.push(collectNamespacedElement(c, uriToPrefix));
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}

function collectNamespacedElement(
  el: Element,
  uriToPrefix: Map<string, string>,
): NamespacedElement {
  const result: NamespacedElement = { attrs: {} };
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    // For namespaced *elements* we collect every attribute (namespaced or
    // not) under the element — unlike root attrs where we filter by NS.
    // Treat `xmlns:*` as structural and skip.
    if (a.name.startsWith('xmlns')) continue;
    result.attrs[a.localName] = a.value;
  }

  let hasChildElements = false;
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (!c.namespaceURI) continue;
    const prefix = uriToPrefix.get(c.namespaceURI);
    if (!prefix) continue;  // child in undeclared NS: drop
    hasChildElements = true;
    const children = (result.children ??= {});
    const list = (children[c.localName] ??= []);
    list.push(collectNamespacedElement(c, uriToPrefix));
  }

  if (!hasChildElements && el.textContent != null && el.textContent.trim() !== '') {
    result.text = el.textContent;
  }

  return result;
}

/** Per-element namespace meta: walked at every parsed SVG element. */
function collectElementMeta(
  el: Element,
  uriToPrefix: Map<string, string>,
): NamespaceMeta | undefined {
  if (uriToPrefix.size === 0) return undefined;
  const meta: NamespaceMeta = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if (!a.namespaceURI) continue;
    const prefix = uriToPrefix.get(a.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    (bucket.attrs ??= {})[a.localName] = a.value;
  }
  // Namespaced child elements on a *standard* SVG element (e.g. a <g>) are
  // also surfaced under elements[] in the same shape used at the root.
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (!c.namespaceURI) continue;
    const prefix = uriToPrefix.get(c.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    const elements = (bucket.elements ??= {});
    const list = (elements[c.localName] ??= []);
    list.push(collectNamespacedElement(c, uriToPrefix));
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

function parseChildren(
  parent: Element,
  ctm: Matrix,
  gradients: GradientTable,
  onWarn: (m: string) => void,
  uriToPrefix: Map<string, string>,
): SvgNode[] {
  const out: SvgNode[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const el = parent.children[i];
    // Skip namespaced children — they belong to `meta.elements`, not nodes.
    // (DOM gives SVG-native elements `http://www.w3.org/2000/svg`.)
    const ns = el.namespaceURI;
    if (ns && ns !== 'http://www.w3.org/2000/svg') continue;
    const node = parseElement(el, ctm, gradients, onWarn, uriToPrefix);
    if (node) {
      if (Array.isArray(node)) out.push(...node);
      else out.push(node);
    }
  }
  return out;
}

function parseElement(
  el: Element,
  ctm: Matrix,
  gradients: GradientTable,
  onWarn: (m: string) => void,
  uriToPrefix: Map<string, string>,
): SvgNode | SvgNode[] | null {
  const tag = el.tagName.toLowerCase();
  if (IGNORED_TAGS.has(tag)) return null;
  if (tag === 'g') {
    const local = parseTransform(el.getAttribute('transform'), onWarn);
    const childCtm = multiply(ctm, local);
    const children = parseChildren(el, childCtm, gradients, onWarn, uriToPrefix);
    const opacity = readOpacityAttr(el, 'opacity');
    const group: SvgNode = { kind: 'group', children };
    if (opacity != null) group.opacity = opacity;
    const meta = collectElementMeta(el, uriToPrefix);
    if (meta) group.meta = meta;
    return group;
  }
  if (SUPPORTED_GROUP_TAGS.has(tag)) {
    // Nested <svg> — treat as a transparent group.
    return parseChildren(el, ctm, gradients, onWarn, uriToPrefix);
  }
  if (tag === 'text') {
    const textNode = parseTextElement(el, ctm, gradients, onWarn);
    if (textNode && !Array.isArray(textNode) && textNode.kind === 'text') {
      const meta = collectElementMeta(el, uriToPrefix);
      if (meta) textNode.meta = meta;
    }
    return textNode;
  }
  if (!SUPPORTED_LEAF_TAGS.has(tag)) {
    onWarn(`unsupported element: <${el.tagName}>`);
    return null;
  }
  const localTransform = parseTransform(el.getAttribute('transform'), onWarn);
  const m = multiply(ctm, localTransform);
  const path = lowerLeaf(el, tag, m, onWarn);
  if (!path) return null;
  const fill = readPaint(el, 'fill', '#000000', gradients, onWarn);
  const stroke = readStroke(el, gradients, onWarn);
  const opacity = readOpacityAttr(el, 'opacity');
  const node: SvgPathNode = { kind: 'path', path, fill };
  if (stroke) node.stroke = stroke;
  if (opacity != null) node.opacity = opacity;
  // Lines are stroke-only by SVG convention; force fill=none if the
  // user didn't specify one.
  if (tag === 'line' && !el.hasAttribute('fill')) {
    node.fill = { kind: 'none' };
  }
  if (tag === 'polyline' && !el.hasAttribute('fill')) {
    // <polyline> defaults to fill=black per spec but the common-case
    // intent is stroke-only. Match the spec default to preserve
    // round-trip honesty; callers can override.
  }
  const meta = collectElementMeta(el, uriToPrefix);
  if (meta) node.meta = meta;
  return node;
}

function lowerLeaf(
  el: Element,
  tag: string,
  m: Matrix,
  onWarn: (msg: string) => void,
): Path | null {
  const num = (name: string, fallback = 0): number => {
    const v = el.getAttribute(name);
    if (v == null) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };
  if (tag === 'rect') {
    const x = num('x', 0);
    const y = num('y', 0);
    const w = num('width', 0);
    const h = num('height', 0);
    const rx = num('rx', 0);
    const ry = num('ry', 0);
    return rectElementToPath(x, y, w, h, rx, ry, m);
  }
  if (tag === 'circle') return circleToPath(num('cx'), num('cy'), num('r'), m);
  if (tag === 'ellipse') return ellipseToPath(num('cx'), num('cy'), num('rx'), num('ry'), m);
  if (tag === 'line') return lineToPath(num('x1'), num('y1'), num('x2'), num('y2'), m);
  if (tag === 'polyline') return polylineToPath(parsePoints(el.getAttribute('points') ?? ''), m);
  if (tag === 'polygon') return polygonToPath(parsePoints(el.getAttribute('points') ?? ''), m);
  if (tag === 'path') {
    const d = el.getAttribute('d') ?? '';
    if (!d.trim()) {
      onWarn('<path> with empty d=');
      return null;
    }
    const raw = parsePathD(d, onWarn);
    return transformPath(raw, m);
  }
  return null;
}

function readPaint(
  el: Element,
  attr: 'fill' | 'stroke',
  defaultColor: string,
  gradients: GradientTable,
  onWarn: (msg: string) => void,
): SvgPaint {
  const raw = el.getAttribute(attr);
  const opacityAttr = el.getAttribute(`${attr}-opacity`);
  const opacity = opacityAttr != null ? clamp01(parseFloat(opacityAttr)) : undefined;
  if (raw == null) {
    if (attr === 'stroke') return { kind: 'none' };
    const out: SvgPaint = { kind: 'solid', color: defaultColor };
    if (opacity != null) (out as { opacity?: number }).opacity = opacity;
    return out;
  }
  const parsed = parsePaintAttr(raw);
  if (!parsed) {
    onWarn(`unrecognized ${attr} value: ${raw}`);
    return { kind: 'solid', color: defaultColor };
  }
  if (parsed.kind === 'none') return { kind: 'none' };
  if (parsed.kind === 'ref') {
    const paint = gradients.get(parsed.id);
    if (!paint) {
      onWarn(`${attr} references unknown gradient #${parsed.id}`);
      return { kind: 'solid', color: defaultColor };
    }
    return { kind: 'gradient', paint };
  }
  const out: SvgPaint = { kind: 'solid', color: parsed.color };
  const a = opacity ?? (parsed.alpha < 1 ? parsed.alpha : undefined);
  if (a != null) (out as { opacity?: number }).opacity = a;
  return out;
}

function readStroke(
  el: Element,
  gradients: GradientTable,
  onWarn: (msg: string) => void,
): SvgStroke | undefined {
  if (!el.hasAttribute('stroke') && !el.hasAttribute('stroke-width')) return undefined;
  const paint = readPaint(el, 'stroke', '#000000', gradients, onWarn);
  if (paint.kind === 'none') return undefined;
  const widthAttr = el.getAttribute('stroke-width');
  const width = widthAttr != null ? parseFloat(widthAttr) : 1;
  const opacityAttr = el.getAttribute('stroke-opacity');
  const stroke: SvgStroke = { paint, width };
  if (opacityAttr != null) {
    const a = clamp01(parseFloat(opacityAttr));
    if (Number.isFinite(a)) stroke.opacity = a;
  }
  const cap = el.getAttribute('stroke-linecap');
  if (cap === 'butt' || cap === 'round' || cap === 'square') {
    stroke.cap = cap;
  } else if (cap != null && cap !== 'inherit') {
    onWarn(`unsupported stroke-linecap: ${cap}`);
  }
  const join = el.getAttribute('stroke-linejoin');
  if (join === 'miter' || join === 'round' || join === 'bevel') {
    stroke.join = join;
  } else if (join === 'arcs' || join === 'miter-clip') {
    onWarn(`stroke-linejoin "${join}" not supported; falling back to miter`);
    stroke.join = 'miter';
  } else if (join != null && join !== 'inherit') {
    onWarn(`unsupported stroke-linejoin: ${join}`);
  }
  const dashAttr = el.getAttribute('stroke-dasharray');
  if (dashAttr != null && dashAttr.trim() !== '' && dashAttr.trim() !== 'none') {
    const parsed = parseDashArray(dashAttr);
    if (parsed) stroke.dash = parsed;
    else onWarn(`unrecognized stroke-dasharray: ${dashAttr}`);
  }
  const miterAttr = el.getAttribute('stroke-miterlimit');
  if (miterAttr != null) {
    const m = parseFloat(miterAttr);
    if (Number.isFinite(m) && m >= 1) stroke.miterLimit = m;
    else onWarn(`unrecognized stroke-miterlimit: ${miterAttr}`);
  }
  return stroke;
}

/**
 * Parse an SVG `stroke-dasharray` value into a non-negative number array.
 * Per spec, odd-length lists are duplicated to make the dash pattern even.
 * Returns null if any token fails to parse as a non-negative finite number.
 */
function parseDashArray(s: string): number[] | null {
  const tokens = s.trim().split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const nums: number[] = [];
  for (const t of tokens) {
    const n = parseFloat(t);
    if (!Number.isFinite(n) || n < 0) return null;
    nums.push(n);
  }
  return nums.length % 2 === 1 ? [...nums, ...nums] : nums;
}

function readOpacityAttr(el: Element, name: string): number | undefined {
  const raw = el.getAttribute(name);
  if (raw == null) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? clamp01(n) : undefined;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Parse an SVG `<text>` element into an `SvgTextNode`. Reads geometry
 * from x/y plus optional `data-weasel-width` / `data-weasel-height`
 * (preserved across weasel→SVG round-trips); falls back to font-metric
 * estimates when those attrs are absent (external SVG sources).
 *
 * Child `<tspan>` elements with their own font/fill attrs become
 * `StyledRun`s on the node. Plain text without `<tspan>` produces no
 * `runs` and the node's `text` is the raw text content.
 */
function parseTextElement(
  el: Element,
  ctm: Matrix,
  gradients: GradientTable,
  onWarn: (m: string) => void,
): SvgNode | null {
  const num = (raw: string | null, fallback: number): number => {
    if (raw == null) return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const localTransform = parseTransform(el.getAttribute('transform'), onWarn);
  const m = multiply(ctm, localTransform);

  const rawX = num(el.getAttribute('x'), 0);
  const rawY = num(el.getAttribute('y'), 0);
  // Translate the anchor point through the accumulated transform. Skew /
  // non-uniform scale on the text node lower the round-trip honestly but
  // skew the box dimensions — the rare cases warn and lose styling.
  const ax = m[0] * rawX + m[2] * rawY + m[4];
  const ay = m[1] * rawX + m[3] * rawY + m[5];

  const style = readTextStyle(el, gradients, onWarn);
  const fontSize = style.fontSize ?? 16;
  const lineHeight = style.lineHeight ?? 1.2;

  const dominantBaseline = el.getAttribute('dominant-baseline');
  const explicitTopAnchor = dominantBaseline === 'text-before-edge'
    || dominantBaseline === 'hanging';
  // If serialized by us, `y` is already the top edge. Otherwise SVG's
  // default is `y` = baseline of the first line — shift up by one
  // line of cap-height so weasel's box top approximates the cap-line.
  const topY = explicitTopAnchor ? ay : ay - fontSize;

  // Walk children: text nodes become plain run text; <tspan> elements
  // become StyledRuns with their attribute overrides applied.
  const runs: StyledRun[] = [];
  let plain = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === 3 /* TEXT_NODE */) {
      const t = child.textContent ?? '';
      if (!t) continue;
      runs.push({ text: t });
      plain += t;
    } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const sp = child as Element;
      if (sp.tagName.toLowerCase() !== 'tspan') {
        onWarn(`<text> child <${sp.tagName}> not supported; flattening text content`);
        const t = sp.textContent ?? '';
        if (t) { runs.push({ text: t }); plain += t; }
        continue;
      }
      const run = readTspanRun(sp, gradients);
      runs.push(run);
      plain += run.text;
    }
  }

  // Estimate dimensions: data-weasel-* attrs win, else heuristic.
  const dataW = num(el.getAttribute('data-weasel-width'), NaN);
  const dataH = num(el.getAttribute('data-weasel-height'), NaN);
  const width = Number.isFinite(dataW) ? dataW : 99999;
  // Newlines in the text drive line count for height estimation.
  const lines = (plain.match(/\n/g)?.length ?? 0) + 1;
  const height = Number.isFinite(dataH) ? dataH : fontSize * lineHeight * lines;

  const opacity = readOpacityAttr(el, 'opacity');
  const node: SvgTextNode = {
    kind: 'text',
    x: topY === ay ? ax : ax,  // x is unchanged by the baseline shift
    y: topY,
    width,
    height,
    text: plain,
  };
  // Only attach `runs` when at least one run carries non-default styling —
  // single-run plain text is cleaner without it. `runsToPlainText(runs)`
  // must equal `text` per kit invariants, so the array must match exactly.
  const hasStyling = runs.some(
    (r) => r.bold || r.italic || r.fontFamily || r.fontSize != null
      || (r.fill && (('color' in r.fill) || ('fill' in r.fill))),
  );
  if (hasStyling) node.runs = runs;
  if (Object.keys(style).length > 0) node.style = style;
  if (opacity != null) node.opacity = opacity;
  return node;
}

function readTspanRun(el: Element, gradients: GradientTable): StyledRun {
  const text = el.textContent ?? '';
  const run: StyledRun = { text };
  const fw = el.getAttribute('font-weight');
  if (fw === 'bold' || fw === '700' || fw === 'bolder') run.bold = true;
  const fs = el.getAttribute('font-style');
  if (fs === 'italic' || fs === 'oblique') run.italic = true;
  const ff = el.getAttribute('font-family');
  if (ff) run.fontFamily = ff;
  const sz = el.getAttribute('font-size');
  if (sz != null) {
    const n = parseFloat(sz);
    if (Number.isFinite(n)) run.fontSize = n;
  }
  const fillAttr = el.getAttribute('fill');
  if (fillAttr) {
    const parsed = parsePaintAttr(fillAttr);
    if (parsed?.kind === 'solid') {
      run.fill = { fill: 'solid', color: parsed.color };
    } else if (parsed?.kind === 'ref') {
      const paint = gradients.get(parsed.id);
      if (paint) run.fill = paint;
    }
  }
  return run;
}

function readTextStyle(
  el: Element,
  gradients: GradientTable,
  onWarn: (m: string) => void,
): TextStyle {
  const style: TextStyle = {};
  const sz = el.getAttribute('font-size');
  if (sz != null) {
    const n = parseFloat(sz);
    if (Number.isFinite(n)) style.fontSize = n;
  }
  const ff = el.getAttribute('font-family');
  if (ff) style.fontFamily = ff;
  const fw = el.getAttribute('font-weight');
  if (fw != null) {
    const n = parseFloat(fw);
    style.fontWeight = Number.isFinite(n) ? n : fw;
  }
  const fs = el.getAttribute('font-style');
  if (fs === 'italic' || fs === 'normal') style.fontStyle = fs;
  const anchor = el.getAttribute('text-anchor');
  if (anchor === 'start') style.align = 'left';
  else if (anchor === 'middle') style.align = 'center';
  else if (anchor === 'end') style.align = 'right';
  // Note: `lineHeight` is no longer read from a `data-weasel-line-height`
  // attribute. Swillustrator carries it through the generic namespace bag
  // as `meta.swill.attrs['line-height']`; svgInterop lifts it into / out of
  // `TextStyle.lineHeight` at the bridge layer. From weasel-svg's POV the
  // value is just an opaque string in `meta`.
  // Edit-overlay-only chrome (`caretColor`, `selectionBackground`,
  // `selectionColor`) is intentionally not persisted — those are UI state,
  // not document content.
  const fillAttr = el.getAttribute('fill');
  if (fillAttr) {
    const parsed = parsePaintAttr(fillAttr);
    if (parsed?.kind === 'solid') {
      style.fill = { fill: 'solid', color: parsed.color } as Paint;
    } else if (parsed?.kind === 'ref') {
      const paint = gradients.get(parsed.id);
      if (paint) style.fill = paint;
    } else if (parsed?.kind === 'none') {
      // Leave fill undefined; defaults to black per resolveTextStyle.
    }
  }
  if (el.hasAttribute('stroke')) {
    onWarn('<text stroke="..."> not supported on text; ignoring');
  }
  return style;
}
