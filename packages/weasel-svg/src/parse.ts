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
  Matrix, ParseResult, SvgNode, SvgPaint, SvgPathNode, SvgStroke,
} from './types';
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
export function parseSvg(svg: string): ParseResult {
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

  const gradients = collectGradients(root, onWarn);
  const nodes = parseChildren(root, IDENTITY_MATRIX, gradients, onWarn);
  return { nodes, warnings };
}

function parseChildren(
  parent: Element,
  ctm: Matrix,
  gradients: GradientTable,
  onWarn: (m: string) => void,
): SvgNode[] {
  const out: SvgNode[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const el = parent.children[i];
    const node = parseElement(el, ctm, gradients, onWarn);
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
): SvgNode | SvgNode[] | null {
  const tag = el.tagName.toLowerCase();
  if (IGNORED_TAGS.has(tag)) return null;
  if (tag === 'g') {
    const local = parseTransform(el.getAttribute('transform'), onWarn);
    const childCtm = multiply(ctm, local);
    const children = parseChildren(el, childCtm, gradients, onWarn);
    const opacity = readOpacityAttr(el, 'opacity');
    const group: SvgNode = { kind: 'group', children };
    if (opacity != null) group.opacity = opacity;
    return group;
  }
  if (SUPPORTED_GROUP_TAGS.has(tag)) {
    // Nested <svg> — treat as a transparent group.
    return parseChildren(el, ctm, gradients, onWarn);
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
