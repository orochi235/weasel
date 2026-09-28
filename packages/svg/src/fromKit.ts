/**
 * The kit-to-SVG direction: scene leaves back to `SvgNode`s, the inverse of
 * `svgNodesToKitDrafts`. Each leaf is written as the built-in painter that
 * draws it would draw it — the pose baked into the geometry, box-relative
 * paints resolved into that box — so `serializeSvg` over the result shows what
 * the canvas shows.
 */
import {
  DEFAULT_SHAPE_FILL,
  fillInPoseFrame,
  pathInPoseFrame,
  type FillStyle,
  type ImageNodeData,
  type Path,
  type Stroke,
  type StyledRun,
  type TextStyle,
  type TextVerticalAlign,
} from '@weasel-js/core';
import type {
  SvgGroupNode, SvgImageNode, SvgNode, SvgPaint, SvgPathNode, SvgStroke, SvgTextNode,
} from './types';

/** A leaf's box: where it is drawn, and the frame its box-relative paints
 *  resolve against. */
export interface SvgKitPose {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** The leaf data the kit's path, text and image painters read — what
 *  `svgNodesToKitDrafts` writes. */
export interface SvgKitLeafData {
  path?: Path;
  fill?: FillStyle | null;
  stroke?: Stroke | null;
  text?: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
  verticalAlign?: TextVerticalAlign;
  image?: ImageNodeData['image'];
}

/** A kit paint as an `SvgPaint`. `null` is `fill="none"`; a box-relative
 *  gradient or pattern is resolved into `box`, since the geometry it paints
 *  is written already placed there. */
export function svgPaintFromKit(fill: FillStyle | null, box: SvgKitPose): SvgPaint {
  if (fill === null) return { kind: 'none' };
  if (fill.fill === undefined || fill.fill === 'solid') {
    return { kind: 'solid', color: fill.color, ...(fill.opacity != null ? { opacity: fill.opacity } : {}) };
  }
  return { kind: 'gradient', paint: fillInPoseFrame(fill, box) };
}

/** A kit `Stroke` as an `SvgStroke` — the inverse of `strokeDataFromSvg`.
 *  One with no paint or no width draws nothing and is written as no stroke. */
export function svgStrokeFromKit(stroke: Stroke | null | undefined, box: SvgKitPose): SvgStroke | undefined {
  if (!stroke?.paint) return undefined;
  const width = stroke.width ?? 1;
  if (!((typeof width === 'object' ? width.px : width) > 0)) return undefined;
  const opacity = stroke.paint.opacity;
  return {
    paint: svgPaintFromKit(stroke.paint, box),
    width,
    ...(opacity != null ? { opacity } : {}),
    ...(stroke.cap !== undefined ? { cap: stroke.cap } : {}),
    ...(stroke.join !== undefined ? { join: stroke.join } : {}),
    ...(stroke.dash !== undefined ? { dash: stroke.dash } : {}),
    ...(stroke.miterLimit !== undefined ? { miterLimit: stroke.miterLimit } : {}),
    ...(stroke.align !== undefined ? { align: stroke.align } : {}),
    ...(stroke.markerStart !== undefined ? { markerStart: stroke.markerStart } : {}),
    ...(stroke.markerMid !== undefined ? { markerMid: stroke.markerMid } : {}),
    ...(stroke.markerEnd !== undefined ? { markerEnd: stroke.markerEnd } : {}),
  };
}

/** Write a `kit:image` leaf as an `SvgImageNode` — the inverse of the image
 *  arm of `svgNodesToKitDrafts`. The pose is the image's box. */
export function svgImageFromKit(image: ImageNodeData['image'], pose: SvgKitPose): SvgImageNode {
  const node: SvgImageNode = {
    kind: 'image', href: image.src,
    x: pose.x, y: pose.y, width: pose.width, height: pose.height,
  };
  if (image.source) node.source = { ...image.source };
  if (image.flipX) node.flipX = true;
  if (image.flipY) node.flipY = true;
  if (image.opacity != null) node.opacity = image.opacity;
  if (pose.rotation) node.rotation = pose.rotation;
  return node;
}

/** A kit `Stroke` kept as one, with its paint resolved into `box` — text
 *  carries the kit's own stroke shape rather than an `SvgStroke`. */
function strokeInPoseFrame(stroke: Stroke, box: SvgKitPose): Stroke {
  return stroke.paint ? { ...stroke, paint: fillInPoseFrame(stroke.paint, box) } : stroke;
}

function runInPoseFrame(run: StyledRun, box: SvgKitPose): StyledRun {
  if (!run.fill && !run.stroke) return run;
  return {
    ...run,
    ...(run.fill ? { fill: fillInPoseFrame(run.fill, box) } : {}),
    ...(run.stroke ? { stroke: strokeInPoseFrame(run.stroke, box) } : {}),
  };
}

/**
 * Write one leaf as the `SvgNode` its built-in painter draws — image, text or
 * path, in the order the painters claim a node. `null` for data none of them
 * draws.
 *
 * A path with no `fill` takes `kit:path`'s fallback: the default shape fill
 * when it has no stroke, and no fill when it has one.
 */
export function svgLeafFromKit(
  data: SvgKitLeafData,
  pose: SvgKitPose,
): SvgPathNode | SvgTextNode | SvgImageNode | null {
  if (data.image) return svgImageFromKit(data.image, pose);
  if (data.text != null) {
    const node: SvgTextNode = {
      kind: 'text', x: pose.x, y: pose.y, width: pose.width, height: pose.height, text: data.text,
    };
    if (data.style) node.style = data.style;
    if (data.runs) node.runs = data.runs.map((r) => runInPoseFrame(r, pose));
    if (data.verticalAlign) node.verticalAlign = data.verticalAlign;
    if (data.fill !== undefined) node.fill = data.fill && fillInPoseFrame(data.fill, pose);
    if (data.stroke) node.stroke = strokeInPoseFrame(data.stroke, pose);
    if (pose.rotation) node.rotation = pose.rotation;
    return node;
  }
  if (!data.path) return null;
  const stroke = svgStrokeFromKit(data.stroke, pose);
  const fill = data.fill !== undefined ? data.fill : stroke ? null : DEFAULT_SHAPE_FILL;
  const node: SvgPathNode = {
    kind: 'path',
    path: pathInPoseFrame(data.path, pose),
    fill: svgPaintFromKit(fill, pose),
  };
  if (stroke) node.stroke = stroke;
  if (pose.rotation) node.rotation = pose.rotation;
  return node;
}

/** One node as {@link svgNodesFromKit} reads it. */
export interface SvgKitTreeNode {
  kind: string;
  data: unknown;
  pose: SvgKitPose;
}

/** The read side of a scene that {@link svgNodesFromKit} walks. A kit
 *  `Scene` is one as it stands. */
export interface SvgKitTree<TId extends string = string> {
  readonly roots: readonly TId[];
  childrenOf(id: TId): readonly TId[];
  get(id: TId): SvgKitTreeNode | undefined;
}

export interface SvgNodesFromKitOptions<TId extends string = string> {
  /** Walk these ids, in this order, instead of the tree's roots. */
  roots?: readonly TId[];
  /** `false` leaves a node out, with everything under it — a hidden layer. */
  include?(id: TId): boolean;
  /** Lower a leaf yourself; `null` leaves it out. Defaults to {@link svgLeafFromKit}. */
  leaf?(id: TId, node: SvgKitTreeNode): SvgNode | null;
  /** Decorate the group written for a container, e.g. with `meta`. */
  group?(id: TId, group: SvgGroupNode): SvgGroupNode;
}

/**
 * Walk a scene's container tree into `SvgNode`s ready for `serializeSvg`:
 * every `container` becomes a group of its children, in z-order, and every
 * leaf goes through {@link svgLeafFromKit} unless `options.leaf` says
 * otherwise.
 */
export function svgNodesFromKit<TId extends string>(
  tree: SvgKitTree<TId>,
  options: SvgNodesFromKitOptions<TId> = {},
): SvgNode[] {
  const { include, leaf, group } = options;
  const emit = (id: TId): SvgNode | null => {
    if (include && !include(id)) return null;
    const node = tree.get(id);
    if (!node) return null;
    if (node.kind === 'container') {
      const children: SvgNode[] = [];
      for (const c of tree.childrenOf(id)) {
        const child = emit(c);
        if (child) children.push(child);
      }
      const g: SvgGroupNode = { kind: 'group', children };
      return group ? group(id, g) : g;
    }
    return leaf ? leaf(id, node) : svgLeafFromKit(node.data as SvgKitLeafData, node.pose);
  };
  const out: SvgNode[] = [];
  for (const id of options.roots ?? tree.roots) {
    const n = emit(id);
    if (n) out.push(n);
  }
  return out;
}
