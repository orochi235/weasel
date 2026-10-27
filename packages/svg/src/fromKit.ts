/**
 * The kit-to-SVG direction: scene leaves back to `SvgNode`s, the inverse of
 * `svgNodesToKitDrafts`. Each leaf is written as the built-in painter that
 * draws it would draw it — the pose baked into the geometry, box-relative
 * paints resolved into that box — so `serializeSvg` over the result shows what
 * the canvas shows.
 */
import {
  fillInPoseFrame,
  clipOutline,
  definesFrame,
  pathInPoseFrame,
  pathThroughPoseFrame,
  poseFrameOf,
  poseLinearOf,
  resolveFill,
  resolveStroke,
  type Paint,
  type ImageNodeData,
  type NodeClip,
  type Path,
  type PoseLinear,
  type Stroke,
  type StyledRun,
  type TextStyle,
  type TextVerticalAlign,
  type Fill,
  type Inherit,
  INHERIT,
  isSolidPaint,
} from '@weasel-js/core';
import { mapFillPaint } from './fillPaint';
import type {
  Matrix, SvgGroupNode, SvgImageNode, SvgNode, SvgPaint, SvgPathNode, SvgStroke, SvgTextNode,
} from './types';
import { paintThroughMatrix, strokeThroughMatrix } from './paintThroughMatrix';
import { asBooleanLeaf, booleanGroupSvg, derivedPathIn } from './booleanGroup';

/** A leaf's box: where it is drawn, and the frame its box-relative paints
 *  resolve against. */
export interface SvgKitPose {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  /** Carried onto a text or image node. A path node has nowhere to hold it,
   *  so a path leaf's is baked into its geometry with its rotation. */
  transform?: PoseLinear;
}

/** The leaf data the kit's path, text and image painters read — what
 *  `svgNodesToKitDrafts` writes. */
export interface SvgKitLeafData {
  path?: Path;
  /** `'inherit'` takes the enclosing container's. */
  fill?: Fill | Inherit | null;
  stroke?: Stroke | Inherit | null;
  text?: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
  verticalAlign?: TextVerticalAlign;
  /** A text node's paint over its whole box, under the glyphs. */
  background?: Fill | null;
  /** A text node's inset from its box to its text, on every side. */
  padding?: number;
  /** `'clip'` cuts a text node's text at its box. */
  overflow?: 'visible' | 'clip';
  image?: ImageNodeData['image'];
}

/** A kit paint as an `SvgPaint`. `null` is `fill="none"`; a box-relative
 *  gradient or pattern is resolved into `box`, since the geometry it paints
 *  is written already placed there. */
export function svgPaintFromKit(fill: Paint | null, box: SvgKitPose): SvgPaint {
  if (fill === null) return { kind: 'none' };
  if (fill.kind === undefined || fill.kind === 'solid') {
    return { kind: 'solid', color: fill.color, ...(fill.opacity != null ? { opacity: fill.opacity } : {}) };
  }
  return { kind: 'gradient', paint: fillInPoseFrame(fill, box) };
}

/** A kit `Stroke` as an `SvgStroke` — the inverse of `strokeDataFromSvg`.
 *  One with no paint or no width draws nothing and is written as no stroke. */
export function svgStrokeFromKit(raw: Stroke | null | undefined, box: SvgKitPose): SvgStroke | undefined {
  const stroke = resolveStroke(raw);
  if (!stroke) return undefined;
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
    ...(stroke.vertexWidths?.length ? { vertexWidths: stroke.vertexWidths } : {}),
    ...(stroke.nib ? { nib: stroke.nib } : {}),
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
  if (pose.transform) node.transform = pose.transform;
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
    ...(run.fill ? { fill: mapFillPaint(run.fill, (p) => fillInPoseFrame(p, box)) } : {}),
    ...(run.stroke ? { stroke: strokeInPoseFrame(run.stroke, box) } : {}),
  };
}

/**
 * Write one leaf as the `SvgNode` its built-in painter draws — image, text or
 * path, in the order the painters claim a node. `null` for data none of them
 * draws. A text node with a `background` is a group: the box, then the text.
 * One that clips is a group clipped to its box as it is drawn, turned with it.
 *
 * An `'inherit'` fill or stroke is none here, with no container to read;
 * {@link svgNodesFromKit} resolves it first.
 *
 * A fill or stroke that paints nothing is written `none`. Under a pose
 * `transform` a stroke's width takes the uniform part of the stretch, as
 * `parseSvg` reads a stroke under a skewed element.
 */
export function svgLeafFromKit(
  data: SvgKitLeafData,
  pose: SvgKitPose,
): SvgPathNode | SvgTextNode | SvgImageNode | SvgGroupNode | null {
  if (data.image) return svgImageFromKit(data.image, pose);
  if (data.text != null) {
    const text = svgTextFromKit({ ...data, text: data.text }, pose);
    const boxPath: Path = { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height };
    const clip = data.overflow === 'clip' ? { clip: pathThroughPoseFrame(boxPath, pose) } : {};
    if (!resolveFill(data.background)) return clip.clip ? { kind: 'group', children: [text], ...clip } : text;
    const box = svgLeafFromKit({ path: boxPath, fill: data.background }, pose) as SvgPathNode;
    return { kind: 'group', children: [box, text], ...clip };
  }
  if (!data.path) return null;
  const stroke = svgStrokeFromKit(resolveStroke(data.stroke), pose);
  const node: SvgPathNode = {
    kind: 'path',
    path: pathInPoseFrame(data.path, pose),
    fill: svgPaintFromKit(resolveFill(data.fill)?.paint ?? null, pose),
  };
  if (stroke) node.stroke = stroke;
  const frame = poseLinearOf(pose) && poseFrameOf(pose);
  if (frame) {
    node.path = pathThroughPoseFrame(node.path, pose);
    node.fill = paintThroughMatrix(node.fill, frame);
    if (stroke) node.stroke = strokeThroughMatrix(stroke, frame);
  } else if (pose.rotation) node.rotation = pose.rotation;
  return node;
}

/** A text leaf's text, in its box inset by `padding` about the same center,
 *  which a rotation turns about. */
function svgTextFromKit(data: SvgKitLeafData & { text: string }, pose: SvgKitPose): SvgTextNode {
  const pad = Math.max(0, Math.min(data.padding ?? 0, pose.width / 2, pose.height / 2));
  const node: SvgTextNode = {
    kind: 'text', x: pose.x + pad, y: pose.y + pad, width: pose.width - 2 * pad, height: pose.height - 2 * pad,
    text: data.text,
  };
  if (data.style) node.style = data.style;
  if (data.runs) node.runs = data.runs.map((r) => runInPoseFrame(r, pose));
  if (data.verticalAlign) node.verticalAlign = data.verticalAlign;
  const fill = resolveFill(data.fill);
  node.fill = fill && mapFillPaint(fill, (p) => fillInPoseFrame(p, pose));
  const stroke = resolveStroke(data.stroke);
  if (stroke) node.stroke = strokeInPoseFrame(stroke, pose);
  if (pose.rotation) node.rotation = pose.rotation;
  if (pose.transform) node.transform = pose.transform;
  return node;
}

/** One node as {@link svgNodesFromKit} reads it. */
export interface SvgKitTreeNode {
  kind: string;
  data: unknown;
  pose: SvgKitPose;
  /** The kit's `SceneNode.hidden`: written with `display="none"`, which
   *  `parseSvg(…, { keepHidden: true })` reads back as `hidden`. */
  hidden?: boolean;
  /** The kit's `SceneNode.clip`: `'outline'` writes the node's children
   *  clipped to its outline, as core's `clipOutline` reads it. */
  clip?: NodeClip;
  /** The node's copies, as the kit's `SceneNode.copiesFromPose` draws them:
   *  each is written as a transformed group of its children. */
  copiesFromPose?(pose: SvgKitPose, node: never): readonly Matrix[] | null;
  /** The kit's `SceneNode.consumesChildren`: a boolean group, written as the
   *  path it derives then a hidden `<g>` of its children (`SvgGroupNode.boolean`). */
  consumesChildren?: boolean;
}

/** The read side of a scene that {@link svgNodesFromKit} walks. A kit
 *  `Scene` is one as it stands. With `composition`, a node's pose is stored in
 *  the frame of the nearest container above it that defines one, as a scene's
 *  is; without, every pose is world. */
export interface SvgKitTree<TId extends string = string> {
  readonly roots: readonly TId[];
  childrenOf(id: TId): readonly TId[];
  get(id: TId): SvgKitTreeNode | undefined;
  readonly composition?: { compose(parent: never, child: never): unknown };
  /** The path a node derives, in the frame its children are stored in. A kit
   *  `Scene` needs none: its document is read for it. */
  derivedPathOf?(id: TId): Path | null;
}

/** Options for {@link svgNodesFromKit}. */
export interface SvgNodesFromKitOptions<TId extends string = string> {
  /** Walk these ids, in this order, instead of the tree's roots. */
  roots?: readonly TId[];
  /** `false` leaves a node out, with everything under it — a hidden layer. */
  include?(id: TId): boolean;
  /** Lower a leaf yourself; `null` leaves it out. Defaults to {@link svgLeafFromKit}.
   *  `inherited` is what the leaf's `'inherit'` fields resolve to; write those
   *  as these, and the walk marks the result as inheriting where SVG's
   *  cascade can carry them. */
  leaf?(id: TId, node: SvgKitTreeNode, inherited: SvgKitInherited): SvgNode | null;
  /** Decorate the `<g>` written for a scene group, e.g. with `meta`. */
  group?(id: TId, group: SvgGroupNode): SvgGroupNode;
  /** Decorate the `<g>` written for a mark with children, so a reader can
   *  tell it from a group: `svgNodesToKitDrafts`'s `mark` option reads one
   *  back. Given, the `<g>` holds the mark's own element, then one `<g>` of its
   *  children carrying the mark's clip, then a transformed `<g>` of that for
   *  each copy; a mark whose children are all left out holds its own element
   *  alone. Not called for a mark whose own element is itself a group, or that
   *  draws nothing. */
  mark?(id: TId, group: SvgGroupNode): SvgGroupNode;
}

/**
 * Walk a scene's tree into `SvgNode`s ready for `serializeSvg`: a group
 * becomes a `<g>` of its children, in z-order, drawing nothing of its own; a
 * mark is written by {@link svgLeafFromKit} unless `options.leaf` says
 * otherwise, and a mark with children is a `<g>` holding that element and then
 * its children, or one `<g>` of them when `options.mark` decorates it. A hidden
 * node is written hidden, with its subtree as it is.
 */
export function svgNodesFromKit<TId extends string>(
  tree: SvgKitTree<TId>,
  options: SvgNodesFromKitOptions<TId> = {},
): SvgNode[] {
  const { include, leaf, group, mark } = options;
  const compose = tree.composition?.compose as ((parent: SvgKitPose, child: SvgKitPose) => SvgKitPose) | undefined;
  // `frame`: the world pose of the frame `id` is stored in, null at the top.
  const emit = (id: TId, up: UpPaint, frame: SvgKitPose | null): SvgNode | null => {
    const stored = tree.get(id);
    const node = stored && compose && frame ? { ...stored, pose: compose(frame, stored.pose) } : stored;
    const own = node && definesFrame(node as { dependsOn?: unknown; derivePose?: unknown }) ? node.pose : frame;
    const out = node && (!include || include(id)) ? lower(id, node, up, own) : null;
    return out && node?.hidden === true ? { ...out, hidden: true } : out;
  };
  // A walk that starts below the top starts in the frame its first id is stored in.
  const frameAbove = (id: TId): SvgKitPose | null => {
    if (!compose) return null;
    const chain: SvgKitTreeNode[] = [];
    const seen = new Set<string>([id]);
    let at = (tree.get(id) as { parent?: TId | null } | undefined)?.parent ?? null;
    while (at !== null && !seen.has(at)) {
      seen.add(at);
      const n = tree.get(at);
      if (!n) break;
      chain.unshift(n);
      at = (n as { parent?: TId | null }).parent ?? null;
    }
    let frame: SvgKitPose | null = null;
    for (const n of chain) {
      const pose: SvgKitPose = frame ? compose(frame, n.pose) : n.pose;
      if (definesFrame(n as { dependsOn?: unknown; derivePose?: unknown })) frame = pose;
    }
    return frame;
  };
  const lower = (id: TId, stored: SvgKitTreeNode, up: UpPaint, frame: SvgKitPose | null): SvgNode | null => {
    const booleans = stored.consumesChildren === true;
    const node = booleans
      ? asBooleanLeaf(stored, derivedPathIn(tree, id), (box) => (compose && frame ? compose(frame, box) : box))
      : stored;
    const own = node.data as SvgKitLeafData | null;
    const isGroup = node.kind === 'group';
    const self = isGroup ? null : markInherits(
      leaf ? leaf(id, node, up) : svgLeafFromKit(resolvedData(own ?? {}, up), node.pose), own ?? {}, up,
    );
    const kids = tree.childrenOf(id);
    if (!isGroup && kids.length === 0) return self;
    const below: UpPaint = {
      fill: own?.fill === INHERIT ? up.fill : resolveFill(own?.fill),
      stroke: own?.stroke === INHERIT ? up.stroke : resolveStroke(own?.stroke),
    };
    // Emitted afresh for each copy: a node object is never shared by two groups.
    const emitChildren = (): SvgNode[] => {
      const children: SvgNode[] = [];
      for (const c of kids) {
        const child = emit(c, below, frame);
        if (child) children.push(child);
      }
      return children;
    };
    const clip = node.clip === 'outline' ? clipOutline(node as never, node.pose) ?? undefined : undefined;
    const copies = node.copiesFromPose?.(node.pose, node as never) ?? [];
    const content = (): SvgGroupNode => ({ kind: 'group', children: emitChildren(), ...(clip ? { clip } : {}) });
    const paint = groupPaintFromKit(own, below, node.pose);
    if (booleans) {
      const g = booleanGroupSvg(self, emitChildren(), own, paint);
      return mark ? mark(id, g) : g;
    }
    // The clip travels with each copy, so it goes inside the transform.
    const copied = (): SvgGroupNode[] => copies.map((transform) => ({ kind: 'group', transform, children: [content()] }));
    const withCopies = (g: SvgGroupNode): SvgGroupNode => (copies.length === 0 ? g : { kind: 'group', children: [g, ...copied()] });
    if (isGroup) {
      const g = withCopies({ ...content(), ...paint });
      return group ? group(id, g) : g;
    }
    if (mark && self && self.kind !== 'group') {
      const kids = content();
      return mark(id, { kind: 'group', children: kids.children.length === 0 ? [self] : [self, kids, ...copied()], ...paint });
    }
    const inner = withCopies(content());
    const parts = clip || copies.length > 0 ? [inner] : inner.children;
    return { kind: 'group', children: self ? [self, ...parts] : parts, ...paint };
  };
  const out: SvgNode[] = [];
  for (const id of options.roots ?? tree.roots) {
    const n = emit(id, NO_UP_PAINT, frameAbove(id));
    if (n) out.push(n);
  }
  return out;
}

/** What a leaf's `'inherit'` fill and stroke resolve to — its nearest
 *  enclosing container's; `null` for none. */
export interface SvgKitInherited {
  fill: Fill | null;
  stroke: Stroke | null;
}
type UpPaint = SvgKitInherited;
const NO_UP_PAINT: UpPaint = { fill: null, stroke: null };

/** Whether SVG's cascade can carry `p` to a child as is: a box-relative
 *  paint resolves against the group's box there, and the kit's against the child's. */
const carries = (p: { paint?: unknown } | null): boolean => p != null && isSolidPaint(p.paint as never);

/** A container's paint as its group's: its own where it has one, marked
 *  inherited where it takes it from above. */
function groupPaintFromKit(own: SvgKitLeafData | null, below: UpPaint, pose: SvgKitPose): Partial<SvgGroupNode> {
  const out: Partial<SvgGroupNode> = {};
  if (below.fill?.paint) out.fill = svgPaintFromKit(below.fill.paint, pose);
  const stroke = svgStrokeFromKit(below.stroke, pose);
  if (stroke) out.stroke = stroke;
  const fill = own?.fill === INHERIT && carries(below.fill);
  const strokes = own?.stroke === INHERIT && carries(below.stroke);
  if (fill || strokes) out.inherits = { ...(fill ? { fill: true } : {}), ...(strokes ? { stroke: true } : {}) };
  return out;
}

/** `data` with its `'inherit'` fields replaced by what they resolve to. */
function resolvedData(data: SvgKitLeafData, up: UpPaint): SvgKitLeafData {
  if (data.fill !== INHERIT && data.stroke !== INHERIT) return data;
  return {
    ...data,
    ...(data.fill === INHERIT ? { fill: up.fill } : {}),
    ...(data.stroke === INHERIT ? { stroke: up.stroke } : {}),
  };
}

/** `out` marked as taking from its group what `data` inherits, where SVG's
 *  cascade carries it as it is, so the serializer leaves it to the group. */
function markInherits(out: SvgNode | null, data: SvgKitLeafData, up: UpPaint): SvgNode | null {
  if (out === null || (out.kind !== 'path' && out.kind !== 'text')) return out;
  const fill = data.fill === INHERIT && carries(up.fill);
  const stroke = data.stroke === INHERIT && carries(up.stroke);
  if (fill || stroke) out.inherits = { ...(fill ? { fill: true } : {}), ...(stroke ? { stroke: true } : {}) };
  return out;
}
