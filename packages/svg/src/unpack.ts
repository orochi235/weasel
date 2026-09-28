/**
 * The `unpack` half of the kit SVG handler (`svgHandler.ts`): parse an SVG
 * file into **native scene nodes** — path/text leaves under containers that
 * mirror the source `<g>` structure — instead of the default single
 * embedded-image node. Opted into via
 * `<SceneCanvas ingestion={{ svg: { unpack: unpackSvgFiles } }}>`.
 *
 * Leaf data targets the kit's built-in painters (`NodeShape.ts`): paths as
 * `{ path, fill?, stroke? }` (the `kit:path` contract), text
 * as `{ text, style?, runs?, fill?, stroke? }` (`kit:text`). Poses are absolute AABBs; the
 * renderer's `pathInPoseFrame` rebases stored geometry into the pose box,
 * so placement and fit-clamping operate on poses alone and never rewrite
 * path coordinates.
 *
 * Placement mirrors the image handler: the file's union AABB is fit-clamped
 * to 90% of the visible viewport and centered on the drop point (or the
 * viewport center), with multi-file batches cascading by a fixed offset.
 * Text takes the clamp through a scaled `fontSize` as well as its pose,
 * since glyph size is not derived from the pose the way path geometry is.
 * Multi-root files are wrapped in one synthesized container so a dropped
 * file arrives as a single selectable unit; a single-root file inserts
 * as-is. Each file commits as one `applyOps` batch, so the whole import is
 * a single undo step.
 *
 */
import { parseSvg } from './parse';
import type { ParseResult, SvgGroupNode, SvgNode, SvgPaint, SvgStroke } from './types';
import type { SvgKitLeafData } from './fromKit';
import {
  boundsOfPath,
  createInsertOp,
  DEFAULT_TEXT_STYLE,
  dwarn,
  fillToBoundsFrame,
  getMarker,
  registerMarker,
  resolveTextStyle,
  solid,
  type FillStyle,
  type ImageNodeData,
  type IngestCtx,
  type Op,
  type ScreenLength,
  type Stroke,
  type StyledRun,
  type TextStyle,
} from '@weasel-js/core';

const CASCADE_OFFSET_PX = 24;
const VIEWPORT_FIT = 0.9;

/** Axis-aligned box, in the coordinate space of the SVG being unpacked. Used
 *  for the bounds a draft occupies before it becomes a scene node. */
export interface SvgDraftBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DraftPose = SvgDraftBounds & { rotation?: number };

/**
 * One node the unpack wants the scene to materialize, in parent-before-child
 * order (a draft's `parentId` always names an earlier draft, or `null` for
 * roots). Leaf `data` is kit-painter-native (see module doc).
 */
export type SvgSceneDraft<TData = Record<string, unknown>> =
  | { kind: 'container'; id: string; parentId: string | null; pose: DraftPose }
  | { kind: 'leaf'; id: string; parentId: string | null; pose: DraftPose; data: TData };

/** A leaf `SvgNode`: everything but a group. */
export type SvgLeafNode = Exclude<SvgNode, SvgGroupNode>;

export interface SvgNodesToKitDraftsOptions<TData> {
  /** Lower a leaf yourself, from the kit data the default writes for it and
   *  the node it came from — for data shaped other than the kit painters', or
   *  metadata the document carries. `null` leaves it out. */
  leaf?(id: string, draft: { pose: DraftPose; data: SvgKitLeafData }, source: SvgLeafNode): TData | null;
}

/** `File.text()` via FileReader — same engine-compat choice as the image
 *  handler's `readAsDataURL` (jsdom ships `FileReader` but not `Blob.text`). */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Mint a fresh node id. Mirrors the scene's default `n{counter}-{random}`
 *  scheme (kept module-private by `core/scene/scene.ts`) — same approach as
 *  `groupAction` / `cloneAction`. */
let svgIdCounter = 0;
function freshSvgNodeId(): string {
  return `n${(svgIdCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Lower an `SvgPaint` onto the `kit:path` painter's `data.fill` — a
 *  `FillStyle`, or `null` for SVG's `fill="none"` (the painter skips the
 *  fill rather than falling back to its default). A solid paint keeps its
 *  `fill-opacity`.
 *
 *  A gradient rides through as the `FillStyle` it already is, normalized to
 *  the leaf's own box: `objectBoundingBox` gradients already are, and a
 *  `userSpaceOnUse` one is rebased so it survives the fit-clamp and the
 *  drop-point placement that move the geometry out from under it. */
export function fillDataFromSvg(
  paint: SvgPaint | undefined,
  box: SvgDraftBounds,
): FillStyle | null | undefined {
  if (!paint) return undefined;
  if (paint.kind === 'none') return null;
  if (paint.kind === 'solid') {
    return paint.opacity != null ? { ...solid(paint.color), opacity: paint.opacity } : solid(paint.color);
  }
  return fillInBoxFrame(paint.paint, box);
}

/** Scale a paint's opacity by `k` — how an element or group `opacity` reaches
 *  leaves whose data has no opacity of its own. Where a fill and a stroke
 *  overlap this is not SVG's group compositing, which flattens first. */
function fadeFill(fill: FillStyle, k: number): FillStyle {
  return k === 1 ? fill : { ...fill, opacity: (fill.opacity ?? 1) * k };
}

function fadeStroke(stroke: Stroke, k: number): Stroke {
  return k === 1 || !stroke.paint ? stroke : { ...stroke, paint: fadeFill(stroke.paint, k) };
}

function fadeRun(run: StyledRun, k: number): StyledRun {
  if (k === 1 || (!run.fill && !run.stroke)) return run;
  return {
    ...run,
    ...(run.fill ? { fill: fadeFill(run.fill, k) } : {}),
    ...(run.stroke ? { stroke: fadeStroke(run.stroke, k) } : {}),
  };
}

/** Lower an `SvgStroke` onto the leaf's `data.stroke`.
 *
 *  Everything the SVG carried — paint, width, cap, join, dash, miter limit,
 *  opacity — lands on the one `Stroke` `data.stroke` takes. The paint is
 *  normalized to the leaf's own box the same way a fill is, so a
 *  `userSpaceOnUse` gradient survives the fit-clamp and the drop-point
 *  placement. */
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
  };
}

/** A text node's paint arrives already lowered to a kit `FillStyle`, not as
 *  the `SvgPaint` a path carries, so it skips `fillDataFromSvg` — but a
 *  `userSpaceOnUse` gradient still needs the same rebase onto the leaf's own
 *  box, or it survives neither the fit-clamp nor the drop-point placement. */
function fillInBoxFrame(fill: FillStyle, box: SvgDraftBounds): FillStyle {
  const units = 'units' in fill ? fill.units : undefined;
  return units === 'world' ? fillToBoundsFrame(fill, box) : fill;
}

/** The same rebase for a run's own overrides, which `<tspan fill="url(#g)">`
 *  puts on the run rather than on the node. */
function runInBoxFrame(run: StyledRun, box: SvgDraftBounds): StyledRun {
  const fill = run.fill ? fillInBoxFrame(run.fill, box) : run.fill;
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
 * union AABB of its descendants (the kit `group` action's convention);
 * path/text leaves carry kit-painter-native data. Empty groups are dropped.
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
  const pushLeaf = (source: SvgLeafNode, parentId: string | null, pose: DraftPose, data: SvgKitLeafData): DraftPose | null => {
    const id = nextId(source);
    const out = options.leaf ? options.leaf(id, { pose, data }, source) : (data as TData);
    if (out === null) return null;
    drafts.push({ kind: 'leaf', id, parentId, pose, data: out });
    return pose;
  };

  // Returns the union AABB of the leaves under `n` so a parent container can
  // compose its own pose; null for empty groups. `inherited` is the product
  // of the enclosing groups' opacities.
  const visit = (n: SvgNode, parentId: string | null, inherited: number): SvgDraftBounds | null => {
    const k = inherited * (n.opacity ?? 1);
    if (n.kind === 'group') {
      const draft: Extract<SvgSceneDraft<TData>, { kind: 'container' }> = {
        kind: 'container',
        id: nextId(n),
        parentId,
        pose: { x: 0, y: 0, width: 0, height: 0 },
      };
      drafts.push(draft);
      let acc: SvgDraftBounds | null = null;
      for (const c of n.children) {
        const b = visit(c, draft.id, k);
        if (b) acc = acc ? unionRect(acc, b) : b;
      }
      if (!acc) {
        drafts.splice(drafts.indexOf(draft), 1);
        return null;
      }
      draft.pose = { x: acc.x, y: acc.y, width: acc.width, height: acc.height };
      return draft.pose;
    }

    if (n.kind === 'text') {
      const pose: DraftPose = {
        x: n.x, y: n.y, width: n.width, height: n.height,
      };
      if (n.rotation) pose.rotation = n.rotation;
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
          ? { fill: fill === null ? null : fadeFill(fillInBoxFrame(fill, box), k) }
          : {}),
        ...(n.stroke !== undefined ? { stroke: fadeStroke(strokeInBoxFrame(n.stroke, box), k) } : {}),
      });
    }

    if (n.kind === 'image') {
      const pose: DraftPose = { x: n.x, y: n.y, width: n.width, height: n.height };
      if (n.rotation) pose.rotation = n.rotation;
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

    // Path leaf. Bounds come from the geometry; `pathInPoseFrame` rebases
    // the stored path onto whatever pose box placement settles on.
    const b = n.path.kind === 'rect'
      ? { x: n.path.x, y: n.path.y, width: n.path.width, height: n.path.height }
      : boundsOfPath(n.path);
    const pose: DraftPose = { x: b.x, y: b.y, width: b.width, height: b.height };
    if (n.rotation) pose.rotation = n.rotation;
    const fill = fillDataFromSvg(n.fill, b);
    const strokeFromSvg = strokeDataFromSvg(n.stroke, b);
    return pushLeaf(n, parentId, pose, {
      path: n.path,
      ...(fill !== undefined ? { fill: fill && fadeFill(fill, k) } : {}),
      ...(strokeFromSvg !== undefined ? { stroke: fadeStroke(strokeFromSvg, k) } : {}),
    });
  };

  for (const n of nodes) visit(n, null, 1);
  return drafts;
}

function isNodeList(input: ParseResult | readonly SvgNode[]): input is readonly SvgNode[] {
  return Array.isArray(input);
}


/**
 * Apply the fit-clamp scale to a text leaf's `fontSize`, which lives in data
 * rather than in the pose and so is untouched by `place`. Glyph size is not
 * derived from the pose box the way a path's geometry is (`pathInPoseFrame`
 * rebases that), so a shrunk file would otherwise arrive with its text at
 * source size, overflowing every box around it.
 *
 * Non-text data passes through, as does an unscaled import.
 */
function scaleTextData(
  data: Record<string, unknown>,
  scale: number,
): Record<string, unknown> {
  if (scale === 1 || typeof data.text !== 'string') return data;
  const style = (data.style ?? {}) as TextStyle;
  // A run's own `fontSize` is absolute and overrides the node's, so it needs
  // the same scale. `fontScale` is relative and rides the node's for free, and
  // a `{ px }` size is pinned to the screen, so the fit clamp never touches it.
  const scaleSize = (v: ScreenLength): ScreenLength => (typeof v === 'number' ? v * scale : v);
  const runs = data.runs as StyledRun[] | undefined;
  return {
    ...data,
    ...(runs
      ? {
        runs: runs.map((r) => (r.fontSize !== undefined
          ? { ...r, fontSize: scaleSize(r.fontSize) }
          : r)),
      }
      : {}),
    style: { ...style, fontSize: scaleSize(style.fontSize ?? resolveTextStyle(style).fontSize) },
  };
}

function unionRect(a: SvgDraftBounds, b: SvgDraftBounds): SvgDraftBounds {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Parse each file and insert its node tree — one undoable `applyOps` batch
 * per file. See the module doc for placement and wrapping policy. A file
 * that fails to parse (or parses to nothing) is skipped with a
 * `console.warn`; the rest proceed.
 */
export async function unpackSvgFiles(files: File[], ctx: IngestCtx): Promise<void> {
  const layer = ((ctx.scene.layers[0]?.id as string | undefined) ?? 'default');
  let index = 0;
  for (const file of files) {
    try {
      const text = await readFileText(file);
      const parsed = parseSvg(text);
      for (const w of parsed.warnings) dwarn('ingest', `svg "${file.name}":`, w);
      let drafts = svgNodesToKitDrafts(parsed, freshSvgNodeId);
      if (drafts.length === 0) {
        console.warn(`weasel ingest: svg "${file.name}" parsed to no drawable nodes`);
        continue;
      }

      // Wrap multi-root files in one synthesized container so the dropped
      // file arrives as a single selectable unit.
      const roots = drafts.filter((d) => d.parentId === null);
      if (roots.length > 1) {
        const wrapperId = freshSvgNodeId();
        const union = roots.map((d) => d.pose).reduce(unionRect);
        drafts = [
          { kind: 'container', id: wrapperId, parentId: null, pose: union },
          ...drafts.map((d) => (d.parentId === null ? { ...d, parentId: wrapperId } : d)),
        ];
      }

      // Fit-clamp + center, mirroring the image handler. Pose-only: the
      // painter rebases stored geometry into the pose box.
      const union = drafts
        .filter((d) => d.parentId === null)
        .map((d) => d.pose)
        .reduce(unionRect);
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
      const place = (p: DraftPose): DraftPose => ({
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
            data: d.kind === 'leaf' ? scaleTextData(d.data, scale) : {},
            parent: d.parentId,
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
