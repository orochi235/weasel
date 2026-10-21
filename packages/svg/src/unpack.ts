/**
 * Parse an SVG file into **native scene nodes** — path/text leaves under
 * containers that mirror the source `<g>` structure — instead of the default
 * single embedded-image node.
 *
 * Leaf data targets the kit's built-in painters. Poses are absolute AABBs, and
 * the renderer rebases stored geometry into the pose box, so placement and
 * fit-clamping operate on poses alone and never rewrite path coordinates.
 * Stroke widths, dashes, font sizes, and letter spacing live in data, so
 * they take the clamp separately.
 */
import { parseSvg } from './parse';
import type { ParseResult, SvgGroupNode, SvgNode, SvgPaint, SvgStroke } from './types';
import { mapFillPaint } from './fillPaint';
import type { SvgKitLeafData } from './fromKit';
import { scaleRuns, scaleStroke, scaleTextStyle } from './metricScale';
import { fadeFill, fadeRun, fadeStroke } from './fadePaint';
import {
  boundsOfPath,
  createInsertOp,
  DEFAULT_TEXT_STYLE,
  dwarn,
  fillToBoundsFrame,
  getMarker,
  registerMarker,
  solid,
  unionAABB,
  type Paint,
  type ImageNodeData,
  type IngestCtx,
  type Op,
  type Path,
  type Stroke,
  type StyledRun,
  type TextStyle,
} from '@weasel-js/core';
import type { SvgDraftBounds, SvgDraftPose } from './draftPose';

const CASCADE_OFFSET_PX = 24;
const VIEWPORT_FIT = 0.9;

/**
 * One node the unpack wants the scene to materialize, in parent-before-child
 * order (a draft's `parentId` always names an earlier draft, or `null` for
 * roots). `hidden` is the source node's, for the caller to map onto whatever
 * it hides a node with.
 *
 * A container's `data` is empty unless its `<g>` is clipped. A scene container
 * clips to what its painter draws, so a clipped one holds the clip as an
 * unpainted path, `{ path, fill: null }`, and its `pose` is the clip's box
 * rather than its children's.
 */
export type SvgSceneDraft<TData = Record<string, unknown>> =
  | { kind: 'container'; id: string; parentId: string | null; pose: SvgDraftPose; data: SvgKitLeafData; hidden?: true }
  | { kind: 'leaf'; id: string; parentId: string | null; pose: SvgDraftPose; data: TData; hidden?: true };

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
}

/** `File.text()` via FileReader: jsdom ships `FileReader` but not `Blob.text`. */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
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
    drafts.push({ kind: 'leaf', id, parentId, pose, data: out, ...(source.hidden ? { hidden: true } : {}) });
    return pose;
  };

  // Returns the pose `n` was drafted with, so a parent container can union
  // its children's axis-aligned boxes; null for empty groups. `inherited` is
  // the product of the enclosing groups' opacities.
  const visit = (n: SvgNode, parentId: string | null, inherited: number): SvgDraftPose | null => {
    const k = inherited * (n.opacity ?? 1);
    if (n.kind === 'group') {
      const draft: Extract<SvgSceneDraft<TData>, { kind: 'container' }> = {
        kind: 'container',
        id: nextId(n),
        parentId,
        pose: { x: 0, y: 0, width: 0, height: 0 },
        data: n.clip ? { path: n.clip, fill: null } : {},
        ...(n.hidden ? { hidden: true } : {}),
      };
      drafts.push(draft);
      const at = drafts.length - 1;
      const acc = unionAABB(n.children.map((c) => visit(c, draft.id, k)));
      if (!acc) {
        // Nothing beneath has a box, so any draft beneath is a kept empty group.
        const kept = drafts.length > at + 1 || (options.keepEmpty?.(n) ?? false);
        if (!kept) drafts.splice(at, 1);
        else if (n.clip) draft.pose = boxOfPath(n.clip);
        return null;
      }
      draft.pose = n.clip ? boxOfPath(n.clip) : acc;
      return draft.pose;
    }

    if (n.kind === 'text') {
      const pose: SvgDraftPose = {
        x: n.x, y: n.y, width: n.width, height: n.height,
      };
      if (n.rotation) pose.rotation = n.rotation;
      if (n.transform) pose.transform = n.transform;
      const box: SvgDraftBounds = {
        x: pose.x, y: pose.y, width: pose.width, height: pose.height,
      };
      // Absent takes the painter's default, which has to be spelled out once
      // there is an opacity to carry.
      const fill = n.fill === undefined && k !== 1 ? DEFAULT_TEXT_STYLE.fill : n.fill;
      return pushLeaf(n, parentId, pose, {
        text: n.text,
        ...(n.style ? { style: n.style } : {}),
        ...(n.verticalAlign ? { verticalAlign: n.verticalAlign } : {}),
        ...(n.runs ? { runs: n.runs.map((r) => fadeRun(runInBoxFrame(r, box), k)) } : {}),
        // `!== undefined`, not a truthiness test: `null` is the document
        // saying `fill="none"`, and absent takes the painter's default.
        ...(fill !== undefined
          ? { fill: fill && mapFillPaint(fill, (p) => fadeFill(fillInBoxFrame(p, box), k)) }
          : {}),
        ...(n.stroke !== undefined ? { stroke: fadeStroke(strokeInBoxFrame(n.stroke, box), k) } : {}),
      });
    }

    if (n.kind === 'image') {
      const pose: SvgDraftPose = { x: n.x, y: n.y, width: n.width, height: n.height };
      if (n.rotation) pose.rotation = n.rotation;
      if (n.transform) pose.transform = n.transform;
      return pushLeaf(n, parentId, pose, {
        image: {
          src: n.href,
          ...(k !== 1 ? { opacity: k } : {}),
          ...(n.source ? { source: { ...n.source } } : {}),
          ...(n.flipX ? { flipX: true } : {}),
          ...(n.flipY ? { flipY: true } : {}),
        } satisfies ImageNodeData['image'],
      });
    }

    const b = boxOfPath(n.path);
    const pose: SvgDraftPose = { x: b.x, y: b.y, width: b.width, height: b.height };
    if (n.rotation) pose.rotation = n.rotation;
    const fill = fillDataFromSvg(n.fill, b);
    const strokeFromSvg = strokeDataFromSvg(n.stroke, b);
    return pushLeaf(n, parentId, pose, {
      path: n.path,
      ...(fill !== undefined ? { fill: fill && { paint: fadeFill(fill, k) } } : {}),
      ...(strokeFromSvg !== undefined ? { stroke: fadeStroke(strokeFromSvg, k) } : {}),
    });
  };

  for (const n of nodes) visit(n, null, 1);
  return drafts;
}

function boxOfPath(path: Path): SvgDraftBounds {
  const b = boundsOfPath(path);
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

function isNodeList(input: ParseResult | readonly SvgNode[]): input is readonly SvgNode[] {
  return Array.isArray(input);
}

/**
 * Apply the fit-clamp scale to the lengths a leaf holds in data rather than
 * in its pose, which `place` does not reach: stroke width and dashes on any
 * leaf, and a text leaf's font size and letter spacing.
 */
function scaleLeafData(
  data: Record<string, unknown>,
  scale: number,
): Record<string, unknown> {
  if (scale === 1) return data;
  const out = { ...data };
  if (out.stroke) out.stroke = scaleStroke(out.stroke as Stroke, scale);
  if (typeof out.text === 'string') {
    out.style = scaleTextStyle(out.style as TextStyle | undefined, scale);
    if (out.runs) out.runs = scaleRuns(out.runs as StyledRun[], scale);
  }
  return out;
}

/**
 * Parse each file and insert its node tree, one undo step per file. Pass it
 * as `<SceneCanvas ingestion={{ svg: { unpack: unpackSvgFiles } }}>`.
 *
 * Each file is fit-clamped to 90% of the visible viewport and centered on the
 * drop point (or the viewport center), with later files cascading by a fixed
 * offset. A multi-root file is wrapped in one container so it arrives as a
 * single selectable unit. Content the file hides arrives hidden
 * (`SceneNode.hidden`) rather than being left out. A file that fails to parse, or parses to nothing,
 * is skipped with a `console.warn`.
 */
export async function unpackSvgFiles(files: File[], ctx: IngestCtx): Promise<void> {
  const layer = ((ctx.scene.layers[0]?.id as string | undefined) ?? 'default');
  let index = 0;
  for (const file of files) {
    try {
      const text = await readFileText(file);
      const parsed = parseSvg(text, { keepHidden: true });
      for (const w of parsed.warnings) dwarn('ingest', `svg "${file.name}":`, w);
      let drafts = svgNodesToKitDrafts(parsed, () => ctx.scene.mintId());
      if (drafts.length === 0) {
        console.warn(`weasel ingest: svg "${file.name}" parsed to no drawable nodes`);
        continue;
      }

      const roots = drafts.filter((d) => d.parentId === null);
      if (roots.length > 1) {
        const wrapperId = ctx.scene.mintId();
        const union = unionAABB(roots.map((d) => d.pose))!;
        drafts = [
          { kind: 'container' as const, id: wrapperId, parentId: null, pose: union, data: {} },
          ...drafts.map((d) => (d.parentId === null ? { ...d, parentId: wrapperId } : d)),
        ];
      }

      // Fit-clamp and center. Pose-only: the painter rebases stored geometry
      // into the pose box.

      const union = unionAABB(drafts.filter((d) => d.parentId === null).map((d) => d.pose))!;
      const view = ctx.viewportWorldRect();
      const scale = Math.min(
        1,
        union.width > 0 ? (view.width * VIEWPORT_FIT) / union.width : 1,
        union.height > 0 ? (view.height * VIEWPORT_FIT) / union.height : 1,
      );
      const target = ctx.point ?? {
        x: view.x + view.width / 2,
        y: view.y + view.height / 2,
      };
      const offset = index * CASCADE_OFFSET_PX;
      const cx = union.x + union.width / 2;
      const cy = union.y + union.height / 2;
      const place = (p: SvgDraftPose): SvgDraftPose => ({
        ...p,
        x: target.x + (p.x - cx) * scale + offset,
        y: target.y + (p.y - cy) * scale + offset,
        width: p.width * scale,
        height: p.height * scale,
      });

      const ops: Op[] = drafts.map((d) =>
        createInsertOp({
          node: {
            id: d.id,
            kind: d.kind,
            layer,
            pose: place(d.pose),
            data: d.kind === 'leaf' ? scaleLeafData(d.data, scale) : d.data,
            parent: d.parentId,
            ...(d.hidden ? { hidden: true } : {}),
          } as unknown as { id: string },
          label: 'Insert SVG',
        }),
      );
      ctx.applyOps(ops, 'Insert SVG');
      index++;
    } catch (err) {
      console.warn(`weasel ingest: svg "${file.name}" failed to parse`, err);
    }
  }
}
