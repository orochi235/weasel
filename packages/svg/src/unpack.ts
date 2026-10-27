/**
 * Parse an SVG file into **native scene nodes** — path/text leaves under
 * containers that mirror the source `<g>` structure — instead of the default
 * single embedded-image node.
 *
 * Leaf data targets the kit's built-in painters. Poses are world AABBs, which
 * an inserter makes local to their containers' frames, and
 * the renderer rebases stored geometry into the pose box, so placement and
 * fit-clamping operate on poses alone and never rewrite path coordinates.
 * Stroke widths, dashes, font sizes, and letter spacing live in data, so
 * they take the clamp separately.
 */
import type { ParseResult, SvgGroupNode, SvgNode, SvgPaint, SvgStroke } from './types';
import { mapFillPaint } from './fillPaint';
import type { SvgKitLeafData } from './fromKit';
import { fadeFill, fadeRun, fadeStroke } from './fadePaint';
import { groupTakes, NO_TAKES, takesOf, type Takes } from './draftTakes';
import {
  boundsOfPath,
  DEFAULT_TEXT_FILL,
  fillToBoundsFrame,
  getMarker,
  INHERIT,
  registerMarker,
  solid,
  unionAABB,
  type BooleanShapeOp,
  type Paint,
  type ImageNodeData,
  type NodeClip,
  type Path,
  type Stroke,
  type StyledRun,
} from '@weasel-js/core';
import type { SvgDraftBounds, SvgDraftPose } from './draftPose';

/**
 * One node the unpack wants the scene to materialize, in parent-before-child
 * order (a draft's `parentId` always names an earlier draft, or `null` for
 * roots). `hidden` is the source node's, for the caller to map onto whatever
 * it hides a node with.
 *
 * A group's `data` is empty unless its `<g>` is clipped. A clipped one declares
 * `clip: 'outline'` and holds the clip as an unpainted path,
 * `{ path, fill: null }`, which is the outline a group clips to; its `pose` is
 * the clip's box rather than its children's. A mark declares a clip only when
 * it is read from a `<g>` `options.mark` claims.
 */
export type SvgSceneDraft<TData = Record<string, unknown>> =
  | { kind: 'group'; id: string; parentId: string | null; pose: SvgDraftPose; data: SvgKitLeafData; clip?: NodeClip; hidden?: true }
  | {
    kind: 'mark'; id: string; parentId: string | null; pose: SvgDraftPose; data: TData; clip?: NodeClip; hidden?: true;
    /** A boolean group of the drafts under it, as `svgNodesFromKit` writes one: give it core's
     *  `booleanGroupFields()` and this as `data.boolean`. Its data's `path` is the result as the
     *  file drew it, which the derivation replaces. */
    boolean?: BooleanShapeOp;
  };

/** A leaf `SvgNode`: everything but a group. */
export type SvgLeafNode = Exclude<SvgNode, SvgGroupNode>;

/** Options for {@link svgNodesToKitDrafts}. */
export interface SvgNodesToKitDraftsOptions<TData> {
  /** Lower a leaf yourself, from the kit data the default writes for it and
   *  the node it came from — for data shaped other than the kit painters', or
   *  metadata the document carries. `null` leaves it out. */
  leaf?(id: string, draft: { pose: SvgDraftPose; data: SvgKitLeafData }, source: SvgLeafNode): TData | null;
  /** Keep a group that draws nothing, which is otherwise dropped — for one
   *  whose metadata means something with no children under it. It is drafted
   *  with its clip's box, or a zero box at the origin. */
  keepEmpty?(source: SvgGroupNode): boolean;
  /** Whether a `<g>` is a mark with children, as `svgNodesFromKit`'s `mark`
   *  option writes one: its first element is drafted as the mark, the
   *  children of the `<g>` after it as the mark's, hidden where that `<g>` is,
   *  with its clip as the mark's `clip: 'outline'`, and anything after that,
   *  such as baked copies, as the mark's further children. A clip on the
   *  claimed `<g>` itself clips the mark as a group around it. A `<g>` whose
   *  first element is a group, or whose second is not, is a group. */
  mark?(source: SvgGroupNode): boolean;
}

/** Lower an `SvgPaint` onto the paint of the `kit:path` painter's
 *  `data.fill` — a `Paint`, or `null` for SVG's `fill="none"` (the painter
 *  skips the fill rather than falling back to its default).
 *
 *  A `userSpaceOnUse` gradient is rebased onto the leaf's own box, so it
 *  survives the fit-clamp and the drop-point placement that move the
 *  geometry out from under it. */
export function fillDataFromSvg(
  paint: SvgPaint | undefined,
  box: SvgDraftBounds,
): Paint | null | undefined {
  if (!paint) return undefined;
  if (paint.kind === 'none') return null;
  if (paint.kind === 'solid') {
    return paint.opacity != null ? { ...solid(paint.color), opacity: paint.opacity } : solid(paint.color);
  }
  return fillInBoxFrame(paint.paint, box);
}


/** Lower an `SvgStroke` onto the leaf's `data.stroke`, or `undefined` for an
 *  unpainted one. The paint is rebased onto the leaf's own box the same way
 *  a fill is. */
export function strokeDataFromSvg(
  stroke: SvgStroke | undefined,
  box: SvgDraftBounds,
): Stroke | undefined {
  if (!stroke || stroke.paint.kind === 'none') return undefined;
  const paint = fillDataFromSvg(stroke.paint, box);
  if (paint === undefined || paint === null) return undefined;
  return {
    paint: stroke.opacity !== undefined ? { ...paint, opacity: stroke.opacity } : paint,
    width: stroke.width,
    ...(stroke.cap !== undefined ? { cap: stroke.cap } : {}),
    ...(stroke.join !== undefined ? { join: stroke.join } : {}),
    ...(stroke.dash !== undefined ? { dash: stroke.dash } : {}),
    ...(stroke.miterLimit !== undefined ? { miterLimit: stroke.miterLimit } : {}),
    ...(stroke.markerStart !== undefined ? { markerStart: stroke.markerStart } : {}),
    ...(stroke.markerMid !== undefined ? { markerMid: stroke.markerMid } : {}),
    ...(stroke.markerEnd !== undefined ? { markerEnd: stroke.markerEnd } : {}),
    ...(stroke.vertexWidths !== undefined ? { vertexWidths: stroke.vertexWidths } : {}),
    ...(stroke.nib !== undefined ? { nib: stroke.nib } : {}),
  };
}

/** Rebase a `userSpaceOnUse` gradient onto the leaf's own box. A text node's
 *  paint is already a kit `Paint`, so it comes here directly. */
function fillInBoxFrame(fill: Paint, box: SvgDraftBounds): Paint {
  const units = 'units' in fill ? fill.units : undefined;
  return units === 'world' ? fillToBoundsFrame(fill, box) : fill;
}

/** The same rebase for a run's own overrides, which `<tspan fill="url(#g)">`
 *  puts on the run rather than on the node. */
function runInBoxFrame(run: StyledRun, box: SvgDraftBounds): StyledRun {
  const fill = run.fill ? mapFillPaint(run.fill, (p) => fillInBoxFrame(p, box)) : run.fill;
  const stroke = run.stroke ? strokeInBoxFrame(run.stroke, box) : run.stroke;
  if (fill === run.fill && stroke === run.stroke) return run;
  return { ...run, ...(fill ? { fill } : {}), ...(stroke ? { stroke } : {}) };
}

/** The same rebase for a `Stroke`'s paint. A stroke with no paint of its own
 *  passes through — there is nothing to rebase. */
function strokeInBoxFrame(stroke: Stroke, box: SvgDraftBounds): Stroke {
  if (!stroke.paint) return stroke;
  const paint = fillInBoxFrame(stroke.paint, box);
  return paint === stroke.paint ? stroke : { ...stroke, paint };
}

/**
 * Walk an `SvgNode[]` tree and emit a flat, parent-before-child list of
 * {@link SvgSceneDraft}s. Each `<g>` becomes a container whose pose is the
 * union AABB of its descendants, or its clip's box when it has one; leaves
 * carry kit-painter-native data. Empty groups are dropped unless
 * `options.keepEmpty` keeps them, and so is a group holding only those.
 *
 * Handed a whole `ParseResult`, it also registers the document's markers
 * (`parsed.markers`), without which the strokes naming them draw bare.
 * Containers carry no opacity, so an element or group `opacity` is multiplied
 * into the paints of every leaf under it.
 *
 * `nextId` is handed the node each id is for. `options.leaf` replaces a leaf's
 * data; a group whose leaves it all leaves out is dropped like an empty one.
 * A boolean group `svgNodesFromKit` wrote is drafted as a mark with `boolean`,
 * its operands under it and shown.
 */
export function svgNodesToKitDrafts<TData = Record<string, unknown>>(
  input: ParseResult | readonly SvgNode[],
  nextId: (source: SvgNode) => string,
  options: SvgNodesToKitDraftsOptions<TData> = {},
): SvgSceneDraft<TData>[] {
  const nodes = isNodeList(input) ? input : input.nodes;
  // Keyed by what they draw, so one already registered is this same marker
  // and re-registering it would only churn the paint memo.
  if (!isNodeList(input)) {
    for (const m of input.markers ?? []) if (getMarker(m.id) === undefined) registerMarker(m);
  }
  const drafts: SvgSceneDraft<TData>[] = [];
  const pushLeaf = (source: SvgLeafNode, parentId: string | null, pose: SvgDraftPose, data: SvgKitLeafData): SvgDraftPose | null => {
    const id = nextId(source);
    const out = options.leaf ? options.leaf(id, { pose, data }, source) : (data as TData);
    if (out === null) return null;
    drafts.push({ kind: 'mark', id, parentId, pose, data: out, ...(source.hidden ? { hidden: true } : {}) });
    return pose;
  };

  // Returns the pose `n` was drafted with, so a parent container can union
  // its children's axis-aligned boxes; null for empty groups. `inherited` is
  // the product of the enclosing groups' opacities, and `from` what a child
  // that sets no paint can take from its container as `'inherit'`.
  const visit = (n: SvgNode, parentId: string | null, inherited: number, from: Takes): SvgDraftPose | null => {
    const k = inherited * (n.opacity ?? 1);
    const takes = takesOf(n, from, k);
    if (n.kind === 'group') {
      const [own, kids, ...more] = n.children;
      if (own && own.kind !== 'group' && kids?.kind === 'group' && kids.boolean) {
        return visitMark(n, own, kids, more, parentId, k, takes);
      }
      // A boolean group whose result is empty is written with no path before its operands.
      if (own?.kind === 'group' && own.boolean) {
        return visitMark(n, emptyResultOf(n), own, [kids, ...more].filter((c) => c !== undefined), parentId, k, takes, true);
      }
      if (own && own.kind !== 'group' && (kids === undefined || kids.kind === 'group') && options.mark?.(n)) {
        if (n.clip) return visit(clippingGroup(n), parentId, inherited, from);
        return visitMark(n, own, kids, more, parentId, k, takes);
      }
      const draft: Extract<SvgSceneDraft<TData>, { kind: 'group' }> = {
        kind: 'group',
        id: nextId(n),
        parentId,
        pose: { x: 0, y: 0, width: 0, height: 0 },
        data: n.clip ? { path: n.clip, fill: null } : {},
        ...(n.clip ? { clip: 'outline' as const } : {}),
        ...(n.hidden ? { hidden: true } : {}),
      };
      drafts.push(draft);
      const at = drafts.length - 1;
      const acc = unionAABB(n.children.map((c) => visit(c, draft.id, k, groupTakes(n, takes, k))));
      if (!acc) {
        // Nothing beneath has a box, so any draft beneath is a kept empty group.
        const kept = drafts.length > at + 1 || (options.keepEmpty?.(n) ?? false);
        if (!kept) drafts.splice(at, 1);
        else if (n.clip) draft.pose = boxOfPath(n.clip);
        return null;
      }
      draft.pose = n.clip ? boxOfPath(n.clip) : acc;
      Object.assign(draft.data, containerPaint(n, takes, draft.pose, k));
      return draft.pose;
    }

    const { pose, data } = leafDraft(n, takes, k);
    return pushLeaf(n, parentId, pose, data);
  };

  // A mark with children as `svgNodesFromKit`'s `mark` option writes one.
  // A mark its leaf leaves out leaves its children to its parent.
  const visitMark = (
    n: SvgGroupNode, own: SvgLeafNode, kids: SvgGroupNode | undefined, more: readonly SvgNode[],
    parentId: string | null, k: number, takes: { fill: boolean; stroke: boolean }, empty = false,
  ): SvgDraftPose | null => {
    const inner = groupTakes(n, takes, k);
    const pose = visit(own, parentId, k, inner);
    const mark = pose === null ? null : drafts.at(-1) as Extract<SvgSceneDraft<TData>, { kind: 'mark' }>;
    const under = mark?.id ?? parentId;
    if (mark && n.hidden) mark.hidden = true;
    if (mark && kids?.clip) mark.clip = 'outline';
    if (mark && kids?.boolean) mark.boolean = kids.boolean;
    const poses = [pose];
    if (kids) {
      const at = drafts.length;
      const kk = k * (kids.opacity ?? 1);
      const below = groupTakes(kids, takesOf(kids, inner, kk), kk);
      for (const c of kids.children) poses.push(visit(c, under, kk, below));
      if (kids.hidden && !kids.boolean) for (const d of drafts.slice(at)) if (d.parentId === under) d.hidden = true;
    }
    for (const c of more) poses.push(visit(c, under, k, inner));
    if (!empty) return unionAABB(poses);
    // An empty result has no box of its own, so the mark takes its operands'.
    const box = unionAABB(poses.slice(1));
    if (mark && box) mark.pose = box;
    return box;
  };

  for (const n of nodes) visit(n, null, 1, NO_TAKES);
  return drafts;
}

/** A leaf's draft pose and its kit-painter data. `takes` says which paints it
 *  takes from its container as `'inherit'`; `k` is the opacity it is faded by. */
function leafDraft(n: SvgLeafNode, takes: { fill: boolean; stroke: boolean }, k: number): { pose: SvgDraftPose; data: SvgKitLeafData } {
  if (n.kind === 'text') {
    const pose: SvgDraftPose = {
      x: n.x, y: n.y, width: n.width, height: n.height,
    };
    if (n.rotation) pose.rotation = n.rotation;
    if (n.transform) pose.transform = n.transform;
    const box: SvgDraftBounds = {
      x: pose.x, y: pose.y, width: pose.width, height: pose.height,
    };
    // Absent is SVG's initial black, which a kit text node has to state.
    const fill = n.fill === undefined ? DEFAULT_TEXT_FILL : n.fill;
    return { pose, data: {
      text: n.text,
      ...(n.style ? { style: n.style } : {}),
      ...(n.verticalAlign ? { verticalAlign: n.verticalAlign } : {}),
      ...(n.runs ? { runs: n.runs.map((r) => fadeRun(runInBoxFrame(r, box), k)) } : {}),
      // `null` is the document saying `fill="none"`.
      ...(takes.fill ? { fill: INHERIT } : { fill: fill && mapFillPaint(fill, (p) => fadeFill(fillInBoxFrame(p, box), k)) }),
      ...(takes.stroke ? { stroke: INHERIT }
        : n.stroke !== undefined ? { stroke: fadeStroke(strokeInBoxFrame(n.stroke, box), k) } : {}),
    } };
  }

  if (n.kind === 'image') {
    const pose: SvgDraftPose = { x: n.x, y: n.y, width: n.width, height: n.height };
    if (n.rotation) pose.rotation = n.rotation;
    if (n.transform) pose.transform = n.transform;
    return { pose, data: {
      image: {
        src: n.href,
        ...(k !== 1 ? { opacity: k } : {}),
        ...(n.source ? { source: { ...n.source } } : {}),
        ...(n.flipX ? { flipX: true } : {}),
        ...(n.flipY ? { flipY: true } : {}),
      } satisfies ImageNodeData['image'],
    } };
  }

  const b = boxOfPath(n.path);
  const pose: SvgDraftPose = { x: b.x, y: b.y, width: b.width, height: b.height };
  if (n.rotation) pose.rotation = n.rotation;
  const fill = fillDataFromSvg(n.fill, b);
  const strokeFromSvg = strokeDataFromSvg(n.stroke, b);
  return { pose, data: {
    path: n.path,
    ...(takes.fill ? { fill: INHERIT } : fill !== undefined ? { fill: fill && { paint: fadeFill(fill, k) } } : {}),
    ...(takes.stroke ? { stroke: INHERIT }
      : strokeFromSvg !== undefined ? { stroke: fadeStroke(strokeFromSvg, k) } : {}),
  } };
}

/** A claimed `<g>` with a clip of its own, as a group clipping it: the clip
 *  reaches the mark's own element too, which a mark's own clip does not. */
function clippingGroup(n: SvgGroupNode): SvgGroupNode {
  const { clip, ...unclipped } = n;
  return {
    kind: 'group', clip, children: [unclipped],
    ...(n.fill ? { fill: n.fill } : {}), ...(n.stroke ? { stroke: n.stroke } : {}), ...(n.inherits ? { inherits: n.inherits } : {}),
  };
}

/** A group's paint as its container's `data`, which its children's `'inherit'` reads. */
function containerPaint(
  n: SvgGroupNode, takes: { fill: boolean; stroke: boolean }, box: SvgDraftBounds, k: number,
): SvgKitLeafData {
  const fill = fillDataFromSvg(n.fill, box);
  const stroke = strokeDataFromSvg(n.stroke, box);
  return {
    ...(takes.fill ? { fill: INHERIT } : fill ? { fill: { paint: fadeFill(fill, k) } } : {}),
    ...(takes.stroke ? { stroke: INHERIT } : stroke ? { stroke: fadeStroke(stroke, k) } : {}),
  };
}

/** The leaf a boolean group `n` draws when its result is empty: no outline, in `n`'s paint. */
function emptyResultOf(n: SvgGroupNode): SvgLeafNode {
  const path: Path = { kind: 'polygon', commands: new Uint8Array(0), coords: new Float32Array(0), fillRule: 'nonzero' };
  return {
    kind: 'path', path, fill: n.fill ?? { kind: 'none' },
    ...(n.stroke ? { stroke: n.stroke } : {}), ...(n.inherits ? { inherits: n.inherits } : {}),
  };
}

function boxOfPath(path: Path): SvgDraftBounds {
  const b = boundsOfPath(path);
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

function isNodeList(input: ParseResult | readonly SvgNode[]): input is readonly SvgNode[] {
  return Array.isArray(input);
}
