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
  type Matrix, type ParseOptions, type ParseResult,
  type SvgNode, type SvgPathNode, IDENTITY_MATRIX,
} from './types';
import {
  multiply, parseTransform, decomposeRotation, rebaseTransform, rotationComponent, isIdentity,
} from './transform';
import { boundsOfPath, transformPath } from '@weasel-js/core';
import { readLength, resolveLength } from './lengths';
import { isNonUniform, paintThroughMatrix, strokeThroughMatrix } from './paintThroughMatrix';
import { collectGradients, type GradientTable } from './gradients';
import { collectPatterns } from './patterns';
import {
  bindStylesheets, deriveStyle, EMPTY_STYLE, ownProp, ownValue, styleValue, type StyleContext,
} from './cascade';
import { mediaEnvironmentFor } from './media';
import { readProperty } from './properties';
import { SUPPORTED_LEAF_TAGS, IGNORED_TAGS, lowerLeaf, storable } from './lowerLeaf';
import { parseViewBoxAttr } from './viewBox';
import { type ClipTable, collectClipPaths, clipFor } from './readClips';
import { readPaint, readStroke, isNonScalingStroke } from './readPaint';
import { isStrokeOutline, unwrapStrokeGroup, withOutlinedStroke } from './strokeOutlineSvg';
import { parseImageElement, parseCroppedImage } from './readImage';
import { parseTextElement } from './readText';
import { ingestMarkers } from './readMarkers';
import { groupPaint, inheritsFrom, NO_GROUP_PAINT, viewportPaintFrom, type GroupPaintFrom } from './groupPaint';
import { booleanAttrOf } from './booleanGroup';
import { textFrameAttrOf } from './framedText';
import { conditionsHold, drawnChildren } from './conditional';
import { parseUse } from './use';
import { collectDocumentMeta, collectElementMeta } from './readMeta';

const SUPPORTED_GROUP_TAGS = new Set(['g', 'svg']);

/** How deep elements may nest, `<use>` references included, before what is deeper is left undrawn. */
export const NESTING_LIMIT = 512;

/** How deep the walk is now. */
let nesting = 0;

/**
 * Public entry point: parse an SVG document string. Errors during DOM
 * parsing produce a `ParseResult` with an empty `nodes` array and an
 * `error` (also its one warning) describing the issue, rather than throwing.
 */
export function parseSvg(svg: string, opts: ParseOptions = {}): ParseResult {
  const warnings: string[] = [];
  const unreadable = (error: string): ParseResult => ({ nodes: [], warnings: [error], error });
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  } catch (e) {
    return unreadable(`failed to parse SVG: ${(e as Error).message}`);
  }
  try {
    return readDocument(doc, opts, warnings, unreadable);
  } finally {
    // jsdom keeps a parsed Document alive, though not a tree taken out of it (docs/traps/testing.md).
    doc.documentElement?.remove();
  }
}

function readDocument(
  doc: Document, opts: ParseOptions, warnings: string[], unreadable: (error: string) => ParseResult,
): ParseResult {
  const onWarn = (m: string): void => { warnings.push(m); };
  const errEl = doc.getElementsByTagName('parsererror')[0];
  if (errEl) return unreadable(`SVG parse error: ${errEl.textContent ?? 'unknown'}`);
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') return unreadable('root element is not <svg>');

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
  let nodes: SvgNode[];
  let markers: ReturnType<typeof ingestMarkers>;
  try {
    nodes = parseChildren(root.children, IDENTITY_MATRIX, rootStyle, NO_GROUP_PAINT, gradients, clips, onWarn, uriToPrefix, opts.keepHidden === true);
    markers = ingestMarkers(root, nodes, gradients, onWarn);
  } catch (e) {
    // Past the nesting limit nothing recurses, so this is a stack some other walk ran out of.
    if (e instanceof RangeError) return unreadable(`SVG nests too deeply to read: ${e.message}`);
    throw e;
  }

  const result: ParseResult = { nodes, warnings };
  if (markers.length > 0) result.markers = markers;
  if (documentMeta) result.documentMeta = documentMeta;
  const viewBox = parseViewBoxAttr(root.getAttribute('viewBox'));
  if (viewBox) result.viewBox = viewBox;
  const width = rootLength(root, 'width', onWarn);
  if (width != null) result.width = width;
  const height = rootLength(root, 'height', onWarn);
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

/** Root `width` / `height` in user units, read as every other length is. A
 *  percentage has no viewport to resolve against, so its number is taken. */
function rootLength(root: Element, name: string, onWarn: (m: string) => void): number | undefined {
  const n = resolveLength(root.getAttribute(name), root, name, name === 'width' ? 'x' : 'y', NaN, onWarn);
  return Number.isFinite(n) ? n : undefined;
}

function parseChildren(
  children: ArrayLike<Element>,
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
  if (children.length === 0) return out;
  if (nesting >= NESTING_LIMIT) {
    onWarn(`elements nest more than ${NESTING_LIMIT} deep; what is deeper is not drawn`);
    return out;
  }
  nesting++;
  try {
    readChildren(children, ctm, style, from, gradients, clips, onWarn, uriToPrefix, keepHidden, out);
  } finally {
    nesting--;
  }
  return out;
}

function readChildren(
  children: ArrayLike<Element>,
  ctm: Matrix,
  style: StyleContext,
  from: GroupPaintFrom,
  gradients: GradientTable,
  clips: ClipTable,
  onWarn: (m: string) => void,
  uriToPrefix: Map<string, string>,
  keepHidden: boolean,
  out: SvgNode[],
): void {
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    // Skip namespaced children — they belong to `meta.elements`, not nodes.
    // (DOM gives SVG-native elements `http://www.w3.org/2000/svg`.)
    const ns = el.namespaceURI;
    if ((ns && ns !== 'http://www.w3.org/2000/svg') || isStrokeOutline(el) || !conditionsHold(el)) continue;
    const hidden = isHiddenElement(el, style);
    if (hidden && !keepHidden && booleanAttrOf(el).boolean === undefined) continue;
    const node = unwrapStrokeGroup(el, parseElement(el, ctm, style, from, gradients, clips, onWarn, uriToPrefix, keepHidden));
    if (!node) continue;
    const parsed = Array.isArray(node) ? node : [node];
    if (hidden) for (const n of parsed) n.hidden = true;
    out.push(...parsed);
  }
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
  if (tag === 'use') return parseUse(el, ctm, style, (t, m, s) => parseElement(t, m, s, from, gradients, clips, onWarn, uriToPrefix, keepHidden), onWarn);
  if (tag === 'g' || tag === 'a' || tag === 'switch') return parseGroup(el, ctm, style, from, gradients, clips, onWarn, uriToPrefix, keepHidden);
  const clipRaw = ownProp(el, 'clip-path');
  if (clipRaw != null && readProperty('clip-path', clipRaw) !== 'none') {
    if (SUPPORTED_GROUP_TAGS.has(tag)) {
      onWarn(`clip-path on <${tag}> is not modeled; only a <g> clips, so it is drawn unclipped`);
    } else {
      // A leaf clips in its own user space, so the clip goes through its transform too.
      const clip = clipFor(el, multiply(ctm, parseTransform(el.getAttribute('transform'))), clips, onWarn);
      const leaf = parseLeaf(el, tag, ctm, style, from, gradients, onWarn, uriToPrefix);
      if (!clip || !leaf) return leaf;
      return { kind: 'group', clip, children: Array.isArray(leaf) ? leaf : [leaf] };
    }
  }
  if (SUPPORTED_GROUP_TAGS.has(tag)) {
    // Nested <svg> — a transparent group that establishes a viewport at
    // (x, y). Inheritance flows through it; clipping does not exist here.
    const childStyle = deriveStyle(style, el);
    const offset: Matrix = [1, 0, 0, 1, readLength(el, 'x', 'x', 0, onWarn), readLength(el, 'y', 'y', 0, onWarn)];
    if (el.hasAttribute('viewBox')) {
      onWarn('nested <svg> viewBox is not modeled; its children are not rescaled');
    }
    return parseChildren(el.children, multiply(ctm, offset), childStyle, viewportPaintFrom(el, from), gradients, clips, onWarn, uriToPrefix, keepHidden);
  }
  return parseLeaf(el, tag, ctm, style, from, gradients, onWarn, uriToPrefix);
}

function parseLeaf(
  el: Element, tag: string, ctm: Matrix, style: StyleContext, from: GroupPaintFrom, gradients: GradientTable,
  onWarn: (m: string) => void, uriToPrefix: Map<string, string>,
): SvgNode | SvgNode[] | null {
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
      const moved = storable(transformPath(path, worldLocal), tag, onWarn);
      if (!moved) return null;
      path = moved;
      baked = multiply(ctm, localTransform);
      const rotComp = rotationComponent(worldLocal);
      if (Math.abs(rotComp) > 1e-4) {
        onWarn(`leaf transform has a rotational component that can't be cleanly stored as rotation; baked into geometry (may not round-trip identically)`);
      }
    }
  }
  const leafStyle = deriveStyle(style, el);
  const fill = paintThroughMatrix(readPaint(leafStyle, 'fill', '#000000', gradients, onWarn), baked, onWarn);
  const ownStroke = withOutlinedStroke(el, readStroke(leafStyle, gradients, onWarn, isNonScalingStroke(el)));
  const stroke = ownStroke && strokeThroughMatrix(ownStroke, baked, onWarn);
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
  const children = parseChildren(drawnChildren(el, onWarn), childCtm, childStyle, paint.children, gradients, clips, onWarn, uriToPrefix, keepHidden);
  const opacity = ownValue(el, 'opacity');
  const group: SvgNode = { kind: 'group', children, ...paint.paint, ...booleanAttrOf(el), ...textFrameAttrOf(el) };
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
  if (SUPPORTED_GROUP_TAGS.has(tag) || tag === 'a' || tag === 'switch') return false;
  const v = styleValue(deriveStyle(style, el), 'visibility');
  return v === 'hidden' || v === 'collapse';
}
