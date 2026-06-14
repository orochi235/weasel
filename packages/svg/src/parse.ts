/**
 * Parse an SVG document string into a `SvgNode[]` tree. Walks the SVG
 * DOM (via the platform's `DOMParser` — jsdom in tests, the browser at
 * runtime) and lowers each supported element to weasel-native shapes.
 *
 * Transforms are pushed onto a matrix stack and collapsed into leaf
 * geometry at the moment a leaf is created, so the output tree never
 * carries `transform` data — even on `<g>` nodes.
 */

import type { Path, PolygonPath } from '@orochi235/weasel';
import { PATH_L, PATH_M, PATH_Z } from '@orochi235/weasel';
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
import type { StyledRun, TextStyle, FillStyle } from '@orochi235/weasel';
import { multiply, parseTransform, decomposeRotation, rotationComponent, isIdentity } from './transform';
import { boundsOfPath } from '@orochi235/weasel';
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
  const fill = readPaint(el, 'fill', '#000000', gradients, onWarn);
  const stroke = readStroke(el, gradients, onWarn);
  const opacity = readOpacityAttr(el, 'opacity');
  // `fill-rule` defaults to `nonzero` per SVG spec; only stamp the field when
  // the source explicitly says `evenodd` and the lowered geometry is a
  // PolygonPath (RectPath has no fillRule slot).
  const fillRuleRaw = readInheritedAttr(el, 'fill-rule');
  if (fillRuleRaw === 'evenodd' && path.kind === 'polygon') {
    path = { ...path, fillRule: 'evenodd' };
  }
  const node: SvgPathNode = { kind: 'path', path, fill };
  if (stroke) node.stroke = stroke;
  if (opacity != null) node.opacity = opacity;
  if (rotation != null) node.rotation = rotation;
  // Lines are stroke-only by SVG convention; force fill=none if neither
  // the line nor an ancestor group specifies a fill.
  if (tag === 'line' && readInheritedAttr(el, 'fill') == null) {
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

/**
 * Extract a single CSS-style declaration's value from a `style="..."`
 * attribute. Returns the trimmed value (e.g. `"#ff0000"`) or null when
 * the property is absent. Case-sensitive on property names per CSS
 * (SVG presentation properties are lower-case anyway).
 */
function readStyleProp(el: Element, prop: string): string | null {
  const style = el.getAttribute('style');
  if (!style) return null;
  // (?:^|;)\s*PROP\s*:\s*([^;]+) — anchors at start or after a `;`
  // separator, allows whitespace around the colon, captures up to the
  // next `;` or end of string.
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const m = re.exec(style);
  if (!m) return null;
  return m[1].trim();
}

/**
 * Read a paint-related attribute (fill / stroke / fill-opacity / etc.)
 * honoring SVG2 cascade rules:
 *
 *   1. `style="prop:value"` beats presentation attribute on the same
 *      element (style is a CSS rule; presentation attrs have specificity
 *      zero — see https://www.w3.org/TR/SVG2/styling.html#PresentationAttributes).
 *   2. `inherit` keyword (or absence of a value) walks up the parent
 *      chain looking for an ancestor with the same property set.
 *   3. Stops at the SVG root; returns null when nothing is found.
 *
 * Returns the raw string value as it appeared in the SVG; the caller is
 * responsible for parsing it (color, gradient ref, number, etc.).
 */
function readInheritedAttr(el: Element | null, name: string): string | null {
  let cur: Element | null = el;
  while (cur) {
    const styleVal = readStyleProp(cur, name);
    const attrVal = cur.getAttribute(name);
    // style beats presentation attr on the SAME element.
    const own = styleVal ?? attrVal;
    if (own != null && own !== 'inherit') return own;
    // `inherit` (or nothing): walk up. Stop after we leave <svg>.
    if (cur.tagName.toLowerCase() === 'svg') return null;
    cur = cur.parentElement;
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
  // Per SVG2 cascade: style="fill:..." beats fill="..." on the same
  // element; absent/inherit values cascade from ancestor groups.
  const raw = readInheritedAttr(el, attr);
  const opacityRaw = readInheritedAttr(el, `${attr}-opacity`);
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
  el: Element,
  gradients: GradientTable,
  onWarn: (msg: string) => void,
): SvgStroke | undefined {
  // Inherited gate: if no ancestor (incl. self) sets stroke or
  // stroke-width via attr or style, there's no stroke to read.
  const inheritedStroke = readInheritedAttr(el, 'stroke');
  const inheritedWidth = readInheritedAttr(el, 'stroke-width');
  if (inheritedStroke == null && inheritedWidth == null) return undefined;
  const paint = readPaint(el, 'stroke', '#000000', gradients, onWarn);
  if (paint.kind === 'none') return undefined;
  const width = inheritedWidth != null ? parseFloat(inheritedWidth) : 1;
  const stroke: SvgStroke = { paint, width };
  const opacityRaw = readInheritedAttr(el, 'stroke-opacity');
  if (opacityRaw != null) {
    const a = clamp01(parseFloat(opacityRaw));
    if (Number.isFinite(a)) stroke.opacity = a;
  }
  const cap = readInheritedAttr(el, 'stroke-linecap');
  if (cap === 'butt' || cap === 'round' || cap === 'square') {
    stroke.cap = cap;
  } else if (cap != null) {
    onWarn(`unsupported stroke-linecap: ${cap}`);
  }
  const join = readInheritedAttr(el, 'stroke-linejoin');
  if (join === 'miter' || join === 'round' || join === 'bevel') {
    stroke.join = join;
  } else if (join === 'arcs' || join === 'miter-clip') {
    onWarn(`stroke-linejoin "${join}" not supported; falling back to miter`);
    stroke.join = 'miter';
  } else if (join != null) {
    onWarn(`unsupported stroke-linejoin: ${join}`);
  }
  const dashAttr = readInheritedAttr(el, 'stroke-dasharray');
  if (dashAttr != null && dashAttr.trim() !== '' && dashAttr.trim() !== 'none') {
    const parsed = parseDashArray(dashAttr);
    if (parsed) stroke.dash = parsed;
    else onWarn(`unrecognized stroke-dasharray: ${dashAttr}`);
  }
  const miterAttr = readInheritedAttr(el, 'stroke-miterlimit');
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
  // attribute. WeaselDraw carries it through the generic namespace bag
  // as `meta.wd.attrs['line-height']`; svgInterop lifts it into / out of
  // `TextStyle.lineHeight` at the bridge layer. From weasel-svg's POV the
  // value is just an opaque string in `meta`.
  // Edit-overlay-only chrome (`caretColor`, `selectionBackground`,
  // `selectionColor`) is intentionally not persisted — those are UI state,
  // not document content.
  const fillAttr = el.getAttribute('fill');
  if (fillAttr) {
    const parsed = parsePaintAttr(fillAttr);
    if (parsed?.kind === 'solid') {
      style.fill = { fill: 'solid', color: parsed.color } as FillStyle;
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
