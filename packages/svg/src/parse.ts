/**
 * Parse an SVG document string into a `SvgNode[]` tree. Walks the SVG
 * DOM (via the platform's `DOMParser` — jsdom in tests, the browser at
 * runtime) and lowers each supported element to weasel-native shapes.
 *
 * Transforms are pushed onto a matrix stack and collapsed into leaf
 * geometry at the moment a leaf is created, so the output tree never
 * carries `transform` data — even on `<g>` nodes.
 */

import type { Path, PolygonPath } from '@weasel-js/core';
import { PATH_L, PATH_M, PATH_Z, pathFromD } from '@weasel-js/core';
import {
  rectElementToPath, circleToPath, ellipseToPath, lineToPath,
  parsePoints, polylineToPath, polygonToPath,
} from './shapes';
import { transformPath } from './shapes';
import type {
  Matrix, NamespaceMeta, NamespacedElement, ParseOptions, ParseResult,
  SvgNode, SvgPaint, SvgPathNode, SvgStroke, SvgTextNode, SvgImageNode,
} from './types';
import type { StyledRun, TextStyle, FillStyle, Stroke } from '@weasel-js/core';
import { multiply, parseTransform, decomposeRotation, rotationComponent, isIdentity } from './transform';
import { boundsOfPath } from '@weasel-js/core';
import { IDENTITY_MATRIX, UNBOUNDED_TEXT_WIDTH } from './types';
import { parsePaintAttr } from './color';
import { collectGradients, type GradientTable } from './gradients';
import { collectPatterns } from './patterns';
import { deriveStyle, EMPTY_STYLE, ownProp, resolveCurrentColor, type StyleContext } from './cascade';

// Every tag set here is compared against a lowercased `tagName`.
/** Element tags we accept and lower; anything else triggers a warning. */
const SUPPORTED_LEAF_TAGS = new Set([
  'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
]);

const SUPPORTED_GROUP_TAGS = new Set(['g', 'svg']);

const IGNORED_TAGS = new Set([
  'defs', 'lineargradient', 'radialgradient', 'pattern',
  'title', 'desc', 'metadata',
]);

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

  // Both paint-server kinds resolve through one `url(#id)` table, so a
  // patterned fill needs no separate lookup path at every use site.
  const gradients = collectGradients(root, onWarn);
  for (const [id, paint] of collectPatterns(root, onWarn)) gradients.set(id, paint);
  const rootStyle = deriveStyle(EMPTY_STYLE, root);
  const nodes = parseChildren(root, IDENTITY_MATRIX, rootStyle, gradients, onWarn, uriToPrefix);

  const result: ParseResult = { nodes, warnings };
  if (documentMeta) result.documentMeta = documentMeta;
  const viewBox = parseViewBoxAttr(root.getAttribute('viewBox'));
  if (viewBox) result.viewBox = viewBox;
  const width = parseRootLength(root.getAttribute('width'), 'width', onWarn);
  if (width != null) result.width = width;
  const height = parseRootLength(root.getAttribute('height'), 'height', onWarn);
  if (height != null) result.height = height;
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

/**
 * Root `width` / `height` as a bare user-unit number. A CSS unit or a
 * percentage is not converted — there is no viewport to resolve it against —
 * so the number is taken as-is and the discarded unit is reported.
 */
function parseRootLength(
  raw: string | null, name: string, onWarn: (m: string) => void,
): number | undefined {
  if (raw == null) return undefined;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return undefined;
  const unit = /^\s*[-+]?[\d.eE+-]+\s*([a-z%]+)\s*$/i.exec(raw)?.[1];
  if (unit) onWarn(`<svg ${name}="${raw}"> unit "${unit}" is not converted; read as ${n}`);
  return n;
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
  style: StyleContext,
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
    const node = parseElement(el, ctm, style, gradients, onWarn, uriToPrefix);
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
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (m: string) => void,
  uriToPrefix: Map<string, string>,
): SvgNode | SvgNode[] | null {
  const tag = el.tagName.toLowerCase();
  if (IGNORED_TAGS.has(tag)) return null;
  if (tag === 'g') {
    const local = parseTransform(el.getAttribute('transform'), onWarn);
    const childCtm = multiply(ctm, local);
    const childStyle = deriveStyle(style, el);
    const children = parseChildren(el, childCtm, childStyle, gradients, onWarn, uriToPrefix);
    const opacity = readOpacityAttr(el, 'opacity');
    const group: SvgNode = { kind: 'group', children };
    if (opacity != null) group.opacity = opacity;
    const meta = collectElementMeta(el, uriToPrefix);
    if (meta) group.meta = meta;
    return group;
  }
  if (SUPPORTED_GROUP_TAGS.has(tag)) {
    // Nested <svg> — a transparent group that establishes a viewport at
    // (x, y). Inheritance flows through it; clipping does not exist here.
    const childStyle = deriveStyle(style, el);
    const x = parseFloat(el.getAttribute('x') ?? '0');
    const y = parseFloat(el.getAttribute('y') ?? '0');
    const offset: Matrix = [1, 0, 0, 1, Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0];
    if (el.hasAttribute('viewBox')) {
      onWarn('nested <svg> viewBox is not modeled; its children are not rescaled');
    }
    return parseChildren(el, multiply(ctm, offset), childStyle, gradients, onWarn, uriToPrefix);
  }
  if (tag === 'text') {
    const textNode = parseTextElement(el, ctm, style, gradients, onWarn);
    if (textNode && !Array.isArray(textNode) && textNode.kind === 'text') {
      const meta = collectElementMeta(el, uriToPrefix);
      if (meta) textNode.meta = meta;
    }
    return textNode;
  }
  if (tag === 'image') {
    const imageNode = parseImageElement(el, ctm, onWarn);
    if (imageNode) {
      const meta = collectElementMeta(el, uriToPrefix);
      if (meta) imageNode.meta = meta;
    }
    return imageNode;
  }
  if (!SUPPORTED_LEAF_TAGS.has(tag)) {
    onWarn(`unsupported element: <${el.tagName}>`);
    return null;
  }
  const localTransform = parseTransform(el.getAttribute('transform'), onWarn);
  // First, lower the leaf into its UNROTATED form (using just the inherited
  // CTM). Then try to extract the LEAF's local transform as a pure rotation
  // about the leaf's AABB center. When that succeeds, store the angle on
  // node.rotation. When it fails AND the leaf transform is non-identity,
  // fall back to baking the full composed matrix into geometry (legacy
  // behavior) and warn if a rotation is present that we are about to lose.
  let path = lowerLeaf(el, tag, ctm, onWarn);
  if (!path) return null;
  let rotation: number | undefined;
  if (!isIdentity(localTransform)) {
    const bounds = pathAabb(path);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const angle = decomposeRotation(localTransform, cx, cy);
    if (angle != null) {
      rotation = angle;
    } else {
      // Bake the matrix in — match legacy behavior.
      path = transformPath(path, localTransform);
      const rotComp = rotationComponent(localTransform);
      if (Math.abs(rotComp) > 1e-4) {
        onWarn(`leaf transform has a rotational component that can't be cleanly stored as rotation; baked into geometry (may not round-trip identically)`);
      }
    }
  }
  const leafStyle = deriveStyle(style, el);
  const fill = readPaint(leafStyle, 'fill', '#000000', gradients, onWarn);
  const stroke = readStroke(leafStyle, gradients, onWarn);
  const opacity = readOpacityAttr(el, 'opacity');
  // `fill-rule` defaults to `nonzero`; only stamp when explicitly `evenodd`
  // and the lowered geometry is a PolygonPath (RectPath has no fillRule slot).
  const fillRuleRaw = leafStyle['fill-rule'] ?? null;
  if (fillRuleRaw === 'evenodd' && path.kind === 'polygon') {
    path = { ...path, fillRule: 'evenodd' };
  }
  const node: SvgPathNode = { kind: 'path', path, fill };
  if (stroke) node.stroke = stroke;
  if (opacity != null) node.opacity = opacity;
  if (rotation != null) node.rotation = rotation;
  // Lines are stroke-only by SVG convention; force fill=none if neither the
  // line nor an ancestor group specifies a fill.
  if (tag === 'line' && (leafStyle['fill'] ?? null) == null) {
    node.fill = { kind: 'none' };
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
    const raw = pathFromD(d, onWarn);
    const transformed = transformPath(raw, m);
    // Reconstitute axis-aligned rectangles so a `{ kind: 'rect' }` source
    // node round-trips back into a `{ kind: 'rect' }` parsed node.
    if (transformed.kind === 'polygon') {
      const rect = polygonToRectIfAxisAligned(transformed);
      if (rect) return rect;
    }
    return transformed;
  }
  return null;
}

/**
 * Detect a polygon whose 4 vertices form an axis-aligned rectangle (in
 * the canonical `M L L L Z` order produced by our serializer), and
 * reconstitute it as a `RectPath`. Returns null on any deviation.
 */
function polygonToRectIfAxisAligned(p: PolygonPath): Path | null {
  const cmds = p.commands;
  if (cmds.length !== 5) return null;
  if (cmds[0] !== PATH_M) return null;
  if (cmds[1] !== PATH_L || cmds[2] !== PATH_L || cmds[3] !== PATH_L) return null;
  if (cmds[4] !== PATH_Z) return null;
  const c = p.coords;
  if (c.length !== 8) return null;
  const x0 = c[0], y0 = c[1];
  const x1 = c[2], y1 = c[3];
  const x2 = c[4], y2 = c[5];
  const x3 = c[6], y3 = c[7];
  // Axis-aligned rectangle: top edge horizontal, right edge vertical, etc.
  if (y0 !== y1 || x1 !== x2 || y2 !== y3 || x3 !== x0) return null;
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y2);
  const width = Math.abs(x1 - x0);
  const height = Math.abs(y2 - y1);
  if (width === 0 || height === 0) return null;
  return { kind: 'rect', x, y, width, height };
}

/**
 * Compute a `Path`'s axis-aligned bounding box. Mirrors the helper used by
 * the serializer for rotation pivot resolution; keep the duplication local
 * to parse.ts for now — lift to a shared module if a third call site
 * appears.
 */
function pathAabb(path: Path): { x: number; y: number; width: number; height: number } {
  if (path.kind === 'rect') {
    return { x: path.x, y: path.y, width: path.width, height: path.height };
  }
  return boundsOfPath(path);
}

function readPaint(
  style: StyleContext,
  attr: 'fill' | 'stroke',
  defaultColor: string,
  gradients: GradientTable,
  onWarn: (msg: string) => void,
): SvgPaint {
  const raw = resolveCurrentColor(style[attr] ?? null, style);
  const opacityRaw = style[`${attr}-opacity`] ?? null;
  const opacity = opacityRaw != null ? clamp01(parseFloat(opacityRaw)) : undefined;
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
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (msg: string) => void,
): SvgStroke | undefined {
  const inheritedStroke = style['stroke'] ?? null;
  const inheritedWidth = style['stroke-width'] ?? null;
  if (inheritedStroke == null && inheritedWidth == null) return undefined;
  const paint = readPaint(style, 'stroke', '#000000', gradients, onWarn);
  if (paint.kind === 'none') return undefined;
  const width = inheritedWidth != null ? parseFloat(inheritedWidth) : 1;
  const stroke: SvgStroke = { paint, width };
  const opacityRaw = style['stroke-opacity'] ?? null;
  if (opacityRaw != null) {
    const a = clamp01(parseFloat(opacityRaw));
    if (Number.isFinite(a)) stroke.opacity = a;
  }
  const cap = style['stroke-linecap'] ?? null;
  if (cap === 'butt' || cap === 'round' || cap === 'square') {
    stroke.cap = cap;
  } else if (cap != null) {
    onWarn(`unsupported stroke-linecap: ${cap}`);
  }
  const join = style['stroke-linejoin'] ?? null;
  if (join === 'miter' || join === 'round' || join === 'bevel') {
    stroke.join = join;
  } else if (join === 'arcs' || join === 'miter-clip') {
    onWarn(`stroke-linejoin "${join}" not supported; falling back to miter`);
    stroke.join = 'miter';
  } else if (join != null) {
    onWarn(`unsupported stroke-linejoin: ${join}`);
  }
  const dashAttr = style['stroke-dasharray'] ?? null;
  if (dashAttr != null && dashAttr.trim() !== '' && dashAttr.trim() !== 'none') {
    const parsed = parseDashArray(dashAttr);
    if (parsed) stroke.dash = parsed;
    else onWarn(`unrecognized stroke-dasharray: ${dashAttr}`);
  }
  const miterAttr = style['stroke-miterlimit'] ?? null;
  if (miterAttr != null) {
    const m = parseFloat(miterAttr);
    if (Number.isFinite(m) && m >= 1) stroke.miterLimit = m;
    else onWarn(`unrecognized stroke-miterlimit: ${miterAttr}`);
  }
  return stroke;
}

/**
 * The stroke keys `readStroke` consults, collected off one element's own
 * attributes rather than the inherited cascade.
 *
 * A `<tspan>` inherits its parent `<text>`'s stroke per the SVG cascade, but
 * the runs model resolves a run's stroke against the node's already — so
 * lifting an inherited value onto the run would write the same paint twice
 * and make an unstyled run look deliberately styled.
 */
const STROKE_KEYS = [
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-miterlimit',
] as const;

function ownStrokeStyle(el: Element): StyleContext {
  const out: Record<string, string> = {};
  for (const k of STROKE_KEYS) {
    const v = ownProp(el, k);
    if (v != null) out[k] = v;
  }
  return out;
}

/**
 * Lower an {@link SvgStroke} to the kit's `Stroke`, whose paint is a
 * `FillStyle` rather than an `SvgPaint`. Returns `undefined` for a stroke
 * that paints nothing, so callers can leave the field absent.
 */
function coreStroke(stroke: SvgStroke | undefined): Stroke | undefined {
  if (!stroke) return undefined;
  let paint: FillStyle;
  if (stroke.paint.kind === 'gradient') {
    paint = stroke.paint.paint;
  } else if (stroke.paint.kind === 'solid') {
    paint = stroke.paint.opacity != null
      ? { fill: 'solid', color: stroke.paint.color, opacity: stroke.paint.opacity }
      : { fill: 'solid', color: stroke.paint.color };
  } else {
    return undefined;
  }
  const out: Stroke = { paint, width: stroke.width };
  if (stroke.cap) out.cap = stroke.cap;
  if (stroke.join) out.join = stroke.join;
  if (stroke.dash) out.dash = stroke.dash;
  if (stroke.miterLimit != null) out.miterLimit = stroke.miterLimit;
  return out;
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
  const raw = ownProp(el, name);
  if (raw == null) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? clamp01(n) : undefined;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Parse an SVG `letter-spacing` value into world units. Accepts a bare
 * number, a `px` suffix, or the `normal` keyword (→ `undefined`, via the
 * `NaN` from `parseFloat('normal')`). Any other unit suffix (`em`, `%`,
 * `pt`, …) is still numerically coerced — `parseFloat` reads the leading
 * digits — but flagged, since e.g. `0.1em` silently becomes `0.1` world
 * units, off by a factor of the font size.
 */
function parseLetterSpacing(raw: string, onWarn: (m: string) => void): number | undefined {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return undefined;
  const unit = /^-?[\d.]+([a-z%]+)$/i.exec(raw.trim())?.[1]?.toLowerCase();
  if (unit && unit !== 'px') {
    onWarn(`letter-spacing "${raw}" uses unit "${unit}", which is not converted; treated as ${n} world units`);
  }
  return n;
}

/**
 * Parse an SVG `text-decoration` value into the two boolean flags the runs
 * model uses. `text-decoration` is a space-separated list of line tokens
 * (`underline`, `line-through`, `overline`, `blink`, `none`), matched
 * case-insensitively per CSS keyword rules; we only model `underline` and
 * `line-through` (→ `strikethrough`) — any other token (including `none`,
 * and unrecognized values like `overline`) is dropped without warning,
 * since it's either the explicit "no decoration" case or a decoration kind
 * the runs model has no key for.
 */
function parseTextDecoration(raw: string | null): { underline?: boolean; strikethrough?: boolean } {
  if (raw == null) return {};
  const tokens = raw.trim().toLowerCase().split(/\s+/);
  const out: { underline?: boolean; strikethrough?: boolean } = {};
  if (tokens.includes('underline')) out.underline = true;
  if (tokens.includes('line-through')) out.strikethrough = true;
  return out;
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
const XLINK_NS = 'http://www.w3.org/1999/xlink';

function parseImageElement(
  el: Element,
  ctm: Matrix,
  onWarn: (m: string) => void,
): SvgImageNode | null {
  const href = el.getAttribute('href')
    ?? el.getAttributeNS(XLINK_NS, 'href')
    ?? el.getAttribute('xlink:href');
  if (!href) {
    onWarn('<image> without href; dropped');
    return null;
  }
  const num = (raw: string | null, fallback: number): number => {
    if (raw == null) return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const rawX = num(el.getAttribute('x'), 0);
  const rawY = num(el.getAttribute('y'), 0);
  const rawW = num(el.getAttribute('width'), 0);
  const rawH = num(el.getAttribute('height'), 0);
  // Map both corners through the inherited CTM and take their AABB, so
  // translate / scale / flip land on the box. A rotation in the *inherited*
  // transform inflates it; the element's own transform is decomposed below.
  const px = (x: number, y: number): [number, number] =>
    [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
  const [x0, y0] = px(rawX, rawY);
  const [x1, y1] = px(rawX + rawW, rawY + rawH);
  const node: SvgImageNode = {
    kind: 'image',
    href,
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
  const opacity = readOpacityAttr(el, 'opacity');
  if (opacity != null) node.opacity = opacity;
  const localTransform = parseTransform(el.getAttribute('transform'), onWarn);
  if (!isIdentity(localTransform)) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const angle = decomposeRotation(localTransform, cx, cy);
    if (angle != null) {
      node.rotation = angle;
    } else {
      const rotComp = rotationComponent(localTransform);
      if (Math.abs(rotComp) > 1e-4) {
        onWarn('<image> transform has a rotational component that can\'t be cleanly stored as rotation; dropped (may not round-trip identically)');
      }
    }
  }
  if (el.hasAttribute('preserveAspectRatio')
    && el.getAttribute('preserveAspectRatio') !== 'none') {
    onWarn('<image> preserveAspectRatio is not modeled; the box is taken literally');
  }
  return node;
}

const XML_NS = 'http://www.w3.org/XML/1998/namespace';

/**
 * Does `xml:space="preserve"` apply to this element? The attribute inherits,
 * so an ancestor can set it.
 *
 * weasel's own `<text>` output carries it, because the runs model stores real
 * line breaks and SVG's default whitespace handling would collapse them away.
 */
function preservesSpace(el: Element): boolean {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const v = e.getAttributeNS(XML_NS, 'space') ?? e.getAttribute('xml:space');
    if (v === 'preserve') return true;
    if (v === 'default') return false;
  }
  return false;
}

/**
 * Apply SVG's default whitespace handling to a `<text>` element's runs, in
 * place: newlines dropped, tabs folded to spaces, runs of spaces collapsed to
 * one, and leading / trailing space stripped across the element as a whole.
 *
 * Without this, importing any pretty-printed SVG drags the source file's
 * indentation into the document text — and, because the height estimate
 * counts newlines, reports a one-line label as four lines tall.
 */
function collapseRunWhitespace(runs: StyledRun[]): void {
  let atStart = true;
  let lastWasSpace = false;
  for (const run of runs) {
    let out = '';
    for (const ch of run.text.replace(/\n/g, '').replace(/[\t\r]/g, ' ')) {
      if (ch === ' ') {
        if (atStart || lastWasSpace) continue;
        out += ' ';
        lastWasSpace = true;
        continue;
      }
      out += ch;
      lastWasSpace = false;
      atStart = false;
    }
    run.text = out;
  }
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].text === '') continue;
    if (runs[i].text.endsWith(' ')) runs[i].text = runs[i].text.slice(0, -1);
    break;
  }
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].text === '') runs.splice(i, 1);
  }
}

function parseTextElement(
  el: Element,
  ctm: Matrix,
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (m: string) => void,
): SvgNode | null {
  const num = (raw: string | null, fallback: number): number => {
    if (raw == null) return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const localTransform = parseTransform(el.getAttribute('transform'), onWarn);
  // Use only the inherited CTM to position the text's anchor; the
  // element-local transform is decomposed below so a pure rotation about
  // the text box's center is surfaced as `node.rotation` rather than
  // baked into the anchor (and lost).
  const m = ctm;

  const rawX = num(el.getAttribute('x'), 0);
  const rawY = num(el.getAttribute('y'), 0);
  // Translate the anchor point through the accumulated transform. Skew /
  // non-uniform scale on the text node lower the round-trip honestly but
  // skew the box dimensions — the rare cases warn and lose styling.
  const ax = m[0] * rawX + m[2] * rawY + m[4];
  const ay = m[1] * rawX + m[3] * rawY + m[5];

  const leafStyle = deriveStyle(style, el);
  const textStyle = readTextStyle(leafStyle, gradients, onWarn);
  const fontSize = textStyle.fontSize ?? 16;
  const lineHeight = textStyle.lineHeight ?? 1.2;

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
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === 3 /* TEXT_NODE */) {
      const t = child.textContent ?? '';
      if (!t) continue;
      runs.push({ text: t });
    } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const sp = child as Element;
      if (sp.tagName.toLowerCase() !== 'tspan') {
        onWarn(`<text> child <${sp.tagName}> not supported; flattening text content`);
        const t = sp.textContent ?? '';
        if (t) runs.push({ text: t });
        continue;
      }
      const run = readTspanRun(sp, gradients, leafStyle, onWarn);
      runs.push(run);
    }
  }
  if (!preservesSpace(el)) collapseRunWhitespace(runs);
  const plain = runs.map((r) => r.text).join('');

  // Estimate dimensions: data-weasel-* attrs win, else heuristic.
  const dataW = num(el.getAttribute('data-weasel-width'), NaN);
  const dataH = num(el.getAttribute('data-weasel-height'), NaN);
  const width = Number.isFinite(dataW) ? dataW : UNBOUNDED_TEXT_WIDTH;
  // Newlines in the text drive line count for height estimation.
  const lines = (plain.match(/\n/g)?.length ?? 0) + 1;
  const height = Number.isFinite(dataH) ? dataH : fontSize * lineHeight * lines;

  const opacity = readOpacityAttr(el, 'opacity');
  const node: SvgTextNode = {
    kind: 'text',
    x: ax,
    y: topY,
    width,
    height,
    text: plain,
  };
  // Only attach `runs` when at least one run carries non-default styling —
  // single-run plain text is cleaner without it. `runsToPlainText(runs)`
  // must equal `text` per kit invariants, so the array must match exactly.
  //
  // "Any key but `text`" rather than an enumeration of the styling keys:
  // `readTspanRun` sets a field only when it parsed one, so the two are
  // equivalent, and the enumerated form silently dropped every run whose
  // only styling was a key added later — which is exactly how `stroke`
  // arrived and vanished.
  const hasStyling = runs.some(
    (r) => Object.entries(r).some(([k, v]) => k !== 'text' && v !== undefined),
  );
  if (hasStyling) node.runs = runs;
  if (Object.keys(textStyle).length > 0) node.style = textStyle;
  if (opacity != null) node.opacity = opacity;
  // Try to extract the element-local transform as a pure rotation about
  // the text box's center. When it doesn't decompose cleanly but contains
  // a rotational component, warn — the legacy code path baked the matrix
  // into the anchor; here we drop it so the warning is mandatory.
  if (!isIdentity(localTransform)) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const angle = decomposeRotation(localTransform, cx, cy);
    if (angle != null) {
      node.rotation = angle;
    } else {
      const rotComp = rotationComponent(localTransform);
      if (Math.abs(rotComp) > 1e-4) {
        onWarn(`<text> transform has a rotational component that can't be cleanly stored as rotation; dropped (may not round-trip identically)`);
      }
    }
  }
  return node;
}

function readTspanRun(
  el: Element,
  gradients: GradientTable,
  style: StyleContext,
  onWarn: (m: string) => void,
): StyledRun {
  const text = el.textContent ?? '';
  const run: StyledRun = { text };
  const fw = ownProp(el, 'font-weight');
  if (fw === 'bold' || fw === '700' || fw === 'bolder') run.bold = true;
  const fs = ownProp(el, 'font-style');
  if (fs === 'italic' || fs === 'oblique') run.italic = true;
  const ff = ownProp(el, 'font-family');
  if (ff) run.fontFamily = ff;
  const sz = ownProp(el, 'font-size');
  if (sz != null) {
    const n = parseFloat(sz);
    if (Number.isFinite(n)) run.fontSize = n;
  }
  const ls = ownProp(el, 'letter-spacing');
  if (ls != null) {
    const n = parseLetterSpacing(ls, onWarn);
    if (n != null) run.letterSpacing = n;
  }
  const decoration = parseTextDecoration(ownProp(el, 'text-decoration'));
  if (decoration.underline) run.underline = true;
  if (decoration.strikethrough) run.strikethrough = true;
  const tspanStyle = deriveStyle(style, el);
  const fillAttr = resolveCurrentColor(ownProp(el, 'fill'), tspanStyle);
  if (fillAttr) {
    const parsed = parsePaintAttr(fillAttr);
    if (parsed?.kind === 'solid') {
      run.fill = { fill: 'solid', color: parsed.color };
    } else if (parsed?.kind === 'ref') {
      const paint = gradients.get(parsed.id);
      if (paint) run.fill = paint;
    }
  }
  // Own attributes only — see `ownStrokeStyle`.
  const stroke = coreStroke(readStroke(ownStrokeStyle(el), gradients, onWarn));
  if (stroke) run.stroke = stroke;
  return run;
}

function readTextStyle(
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (m: string) => void,
): TextStyle {
  const out: TextStyle = {};
  const sz = style['font-size'];
  if (sz != null) {
    const n = parseFloat(sz);
    if (Number.isFinite(n)) out.fontSize = n;
  }
  const ff = style['font-family'];
  if (ff) out.fontFamily = ff;
  const fw = style['font-weight'];
  if (fw != null) {
    const n = parseFloat(fw);
    out.fontWeight = Number.isFinite(n) ? n : fw;
  }
  const fs = style['font-style'];
  if (fs === 'italic' || fs === 'normal') out.fontStyle = fs;
  const anchor = style['text-anchor'];
  if (anchor === 'start') out.align = 'left';
  else if (anchor === 'middle') out.align = 'center';
  else if (anchor === 'end') out.align = 'right';
  const ls = style['letter-spacing'];
  if (ls != null) {
    const n = parseLetterSpacing(ls, onWarn);
    if (n != null) out.letterSpacing = n;
  }
  const decoration = parseTextDecoration(style['text-decoration'] ?? null);
  if (decoration.underline) out.underline = true;
  if (decoration.strikethrough) out.strikethrough = true;
  // Note: `lineHeight` is no longer read from a `data-weasel-line-height`
  // attribute. WeaselDraw carries it through the generic namespace bag
  // as `meta.wd.attrs['line-height']`; svgInterop lifts it into / out of
  // `TextStyle.lineHeight` at the bridge layer. From weasel-svg's POV the
  // value is just an opaque string in `meta`.
  // Edit-overlay-only chrome (`caretColor`, `selectionBackground`,
  // `selectionColor`) is intentionally not persisted — those are UI state,
  // not document content.
  const fillRaw = resolveCurrentColor(style['fill'] ?? null, style);
  if (fillRaw) {
    const parsed = parsePaintAttr(fillRaw);
    if (parsed?.kind === 'solid') {
      out.fill = { fill: 'solid', color: parsed.color } as FillStyle;
    } else if (parsed?.kind === 'ref') {
      const paint = gradients.get(parsed.id);
      if (paint) out.fill = paint;
    }
    // parsed.kind === 'none' → leave fill undefined (defaults to black downstream).
  }
  // Text strokes used to be dropped here with a warning: an SDF glyph is a
  // sampled field, with no geometry to stroke. The outline tier gave large
  // text real contours, so a stroke is now a paint like any other — and one
  // that stays in the document even at sizes that render it unstroked.
  const stroke = coreStroke(readStroke(style, gradients, onWarn));
  if (stroke) out.stroke = stroke;
  return out;
}
