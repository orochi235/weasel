/**
 * Parse an SVG document string into a `SvgNode[]` tree. Walks the SVG
 * DOM (via the platform's `DOMParser` — jsdom in tests, the browser at
 * runtime) and lowers each supported element to weasel-native shapes.
 *
 * Transforms are pushed onto a matrix stack and collapsed into leaf
 * geometry at the moment a leaf is created, so the output tree never
 * carries `transform` data — even on `<g>` nodes.
 */

import {
  type Matrix, type NamespaceMeta, type NamespacedElement, type ParseOptions, type ParseResult,
  type SvgNode, type SvgPathNode, IDENTITY_MATRIX,
} from './types';
import {
  multiply, parseTransform, decomposeRotation, rebaseTransform, rotationComponent, isIdentity,
} from './transform';
import { boundsOfPath, transformPath } from '@weasel-js/core';
import { ABSOLUTE_PX } from './absoluteUnits';
import { emsPer, fontSizeOf } from './fontSize';
import { isNonUniform, paintThroughMatrix, strokeThroughMatrix } from './paintThroughMatrix';
import { collectGradients, type GradientTable } from './gradients';
import { collectPatterns } from './patterns';
import {
  bindStylesheets, deriveStyle, EMPTY_STYLE, ownProp, ownValue, styleValue, type StyleContext,
} from './cascade';
import { mediaEnvironmentFor } from './media';
import { readProperty } from './properties';
import { SUPPORTED_LEAF_TAGS, IGNORED_TAGS, lowerLeaf } from './lowerLeaf';
import { parseViewBoxAttr } from './viewBox';
import { type ClipTable, collectClipPaths, clipFor } from './readClips';
import { readPaint, readStroke, isNonScalingStroke } from './readPaint';
import { isStrokeOutline, unwrapStrokeGroup, withVariableWidth } from './variableWidthSvg';
import { parseImageElement, parseCroppedImage } from './readImage';
import { parseTextElement } from './readText';
import { ingestMarkers } from './readMarkers';
import { groupPaint, inheritsFrom, NO_GROUP_PAINT, viewportPaintFrom, type GroupPaintFrom } from './groupPaint';
import { booleanAttrOf } from './booleanGroup';

const SUPPORTED_GROUP_TAGS = new Set(['g', 'svg']);

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

  bindStylesheets(doc, mediaEnvironmentFor(root, opts.media), onWarn);

  const namespaces = opts.namespaces ?? {};
  // Build a URI → prefix index for fast lookup during traversal.
  const uriToPrefix = new Map(Object.entries(namespaces).map(([prefix, uri]) => [uri, prefix]));

  const documentMeta = collectDocumentMeta(root, uriToPrefix);

  // Both paint-server kinds resolve through one `url(#id)` table, so a
  // patterned fill needs no separate lookup path at every use site.
  const gradients = collectGradients(root, onWarn);
  for (const [id, paint] of collectPatterns(root, onWarn)) gradients.set(id, paint);
  const rootStyle = deriveStyle(EMPTY_STYLE, root);
  const clips = collectClipPaths(root, onWarn);
  const nodes = parseChildren(root, IDENTITY_MATRIX, rootStyle, NO_GROUP_PAINT, gradients, clips, onWarn, uriToPrefix, opts.keepHidden === true);
  const markers = ingestMarkers(root, nodes, gradients, onWarn);

  const result: ParseResult = { nodes, warnings };
  if (markers.length > 0) result.markers = markers;
  if (documentMeta) result.documentMeta = documentMeta;
  const viewBox = parseViewBoxAttr(root.getAttribute('viewBox'));
  if (viewBox) result.viewBox = viewBox;
  const width = parseRootLength(root.getAttribute('width'), 'width', fontSizeOf(rootStyle), onWarn);
  if (width != null) result.width = width;
  const height = parseRootLength(root.getAttribute('height'), 'height', fontSizeOf(rootStyle), onWarn);
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
 * Root `width` / `height` in user units, an absolute CSS unit converted at 96
 * per inch and an `em` or `ex` by the root's `fontSize`. A percentage is not
 * converted — there is no viewport to resolve it against — so the number is
 * taken as-is and the discarded unit is reported.
 */
function parseRootLength(
  raw: string | null, name: string, fontSize: number, onWarn: (m: string) => void,
): number | undefined {
  if (raw == null) return undefined;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return undefined;
  const unit = /^\s*[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?\s*([a-z%]+)\s*$/i.exec(raw)?.[1];
  const scale = unit && ABSOLUTE_PX[unit.toLowerCase()];
  if (scale) return n * scale;
  const ems = unit && emsPer(unit);
  if (ems) return n * ems * fontSize;
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
  from: GroupPaintFrom,
  gradients: GradientTable,
  clips: ClipTable,
  onWarn: (m: string) => void,
  uriToPrefix: Map<string, string>,
  keepHidden: boolean,
): SvgNode[] {
  const out: SvgNode[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const el = parent.children[i];
    // Skip namespaced children — they belong to `meta.elements`, not nodes.
    // (DOM gives SVG-native elements `http://www.w3.org/2000/svg`.)
    const ns = el.namespaceURI;
    if ((ns && ns !== 'http://www.w3.org/2000/svg') || isStrokeOutline(el)) continue;
    const hidden = isHiddenElement(el, style);
    if (hidden && !keepHidden && booleanAttrOf(el).boolean === undefined) continue;
    const node = unwrapStrokeGroup(el, parseElement(el, ctm, style, from, gradients, clips, onWarn, uriToPrefix, keepHidden));
    if (!node) continue;
    const parsed = Array.isArray(node) ? node : [node];
    if (hidden) for (const n of parsed) n.hidden = true;
    out.push(...parsed);
  }
  return out;
}

function parseElement(
  el: Element,
  ctm: Matrix,
  style: StyleContext,
  from: GroupPaintFrom,
  gradients: GradientTable,
  clips: ClipTable,
  onWarn: (m: string) => void,
  uriToPrefix: Map<string, string>,
  keepHidden: boolean,
): SvgNode | SvgNode[] | null {
  const tag = el.tagName.toLowerCase();
  if (IGNORED_TAGS.has(tag)) return null;
  if (tag === 'g' && el.hasAttribute('data-weasel-image')) {
    const image = parseCroppedImage(el, ctm, onWarn);
    if (image) {
      const meta = collectElementMeta(el, uriToPrefix);
      if (meta) image.meta = meta;
      return image;
    }
  }
  const clipRaw = tag === 'g' ? null : ownProp(el, 'clip-path');
  if (clipRaw != null && readProperty('clip-path', clipRaw) !== 'none') {
    onWarn(`clip-path on <${tag}> is not modeled; only a <g> clips, so it is drawn unclipped`);
  }
  if (tag === 'g') return parseGroup(el, ctm, style, from, gradients, clips, onWarn, uriToPrefix, keepHidden);
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
    return parseChildren(el, multiply(ctm, offset), childStyle, viewportPaintFrom(el, from), gradients, clips, onWarn, uriToPrefix, keepHidden);
  }
  if (tag === 'text') {
    const textNode = parseTextElement(el, ctm, style, gradients, onWarn);
    if (textNode && !Array.isArray(textNode) && textNode.kind === 'text') {
      const meta = collectElementMeta(el, uriToPrefix);
      if (meta) textNode.meta = meta;
      Object.assign(textNode, inheritsFrom(el, from));
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
  let baked = ctm;
  if (!isIdentity(localTransform)) {
    // `path` is already through `ctm`, so the element's own transform has to
    // be too before it is compared against these bounds.
    const worldLocal = rebaseTransform(ctm, localTransform);
    const bounds = boundsOfPath(path);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const angle = worldLocal && decomposeRotation(worldLocal, cx, cy);
    if (!worldLocal) {
      onWarn('leaf transform sits under a singular parent transform; dropped');
    } else if (angle != null) {
      rotation = angle;
    } else {
      // Bake the matrix in — match legacy behavior.
      path = transformPath(path, worldLocal);
      baked = multiply(ctm, localTransform);
      const rotComp = rotationComponent(worldLocal);
      if (Math.abs(rotComp) > 1e-4) {
        onWarn(`leaf transform has a rotational component that can't be cleanly stored as rotation; baked into geometry (may not round-trip identically)`);
      }
    }
  }
  const leafStyle = deriveStyle(style, el);
  const fill = paintThroughMatrix(readPaint(leafStyle, 'fill', '#000000', gradients, onWarn), baked);
  const ownStroke = withVariableWidth(el, readStroke(leafStyle, gradients, onWarn, isNonScalingStroke(el)));
  const stroke = ownStroke && strokeThroughMatrix(ownStroke, baked);
  if (stroke && typeof stroke.width === 'number' && isNonUniform(baked)) {
    onWarn(`<${tag}> stroke sits under a skew or non-uniform scale; its width takes the uniform part only`);
  }
  const opacity = ownValue(el, 'opacity');
  // `fill-rule` defaults to `nonzero`; only stamp when explicitly `evenodd`
  // and the lowered geometry is a PolygonPath (RectPath has no fillRule slot).
  if (styleValue(leafStyle, 'fill-rule') === 'evenodd' && path.kind === 'polygon') {
    path = { ...path, fillRule: 'evenodd' };
  }
  const node: SvgPathNode = { kind: 'path', path, fill };
  if (stroke) node.stroke = stroke;
  if (opacity != null) node.opacity = opacity;
  if (rotation != null) node.rotation = rotation;
  Object.assign(node, inheritsFrom(el, from));
  // Lines are stroke-only by SVG convention; force fill=none if neither the
  // line nor an ancestor group specifies a fill.
  if (tag === 'line' && (leafStyle['fill'] ?? null) == null) {
    node.fill = { kind: 'none' };
  }
  const meta = collectElementMeta(el, uriToPrefix);
  if (meta) node.meta = meta;
  return node;
}

function parseGroup(
  el: Element, ctm: Matrix, style: StyleContext, from: GroupPaintFrom, gradients: GradientTable,
  clips: ClipTable, onWarn: (m: string) => void, uriToPrefix: Map<string, string>, keepHidden: boolean,
): SvgNode {
  const childCtm = multiply(ctm, parseTransform(el.getAttribute('transform'), onWarn));
  const childStyle = deriveStyle(style, el);
  const paint = groupPaint(el, from, childStyle, childCtm, gradients, onWarn);
  const children = parseChildren(el, childCtm, childStyle, paint.children, gradients, clips, onWarn, uriToPrefix, keepHidden);
  const opacity = ownValue(el, 'opacity');
  const group: SvgNode = { kind: 'group', children, ...paint.paint, ...booleanAttrOf(el) };
  const clip = clipFor(el, childCtm, clips, onWarn);
  if (clip) group.clip = clip;
  if (opacity != null) group.opacity = opacity;
  const meta = collectElementMeta(el, uriToPrefix);
  if (meta) group.meta = meta;
  return group;
}

/** Whether SVG leaves `el` undrawn: `display="none"` on it, or a leaf whose
 *  `visibility` resolves hidden. That one is inherited and a descendant may
 *  turn itself back on, so a `<g>` cannot answer it and is still walked. */
function isHiddenElement(el: Element, style: StyleContext): boolean {
  const tag = el.tagName.toLowerCase();
  if (IGNORED_TAGS.has(tag)) return false;
  if (ownValue(el, 'display') === 'none') return true;
  if (SUPPORTED_GROUP_TAGS.has(tag)) return false;
  const v = styleValue(deriveStyle(style, el), 'visibility');
  return v === 'hidden' || v === 'collapse';
}
