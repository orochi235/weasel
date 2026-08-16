/**
 * The `unpack` half of the kit SVG handler (`svgHandler.ts`): parse an SVG
 * file into **native scene nodes** — path/text leaves under containers that
 * mirror the source `<g>` structure — instead of the default single
 * embedded-image node. Opted into via
 * `<SceneCanvas ingestion={{ svg: { unpack: unpackSvgFiles } }}>`.
 *
 * Leaf data targets the kit's built-in painters (`NodeShape.ts`): paths as
 * `{ path, fill?, stroke?, strokeWidth? }` (the `kit:path` contract), text
 * as `{ text, style? }` (`kit:text`). Poses are absolute AABBs; the
 * renderer's `pathInPoseFrame` rebases stored geometry into the pose box,
 * so placement and fit-clamping operate on poses alone and never rewrite
 * path coordinates.
 *
 * Placement mirrors the image handler: the file's union AABB is fit-clamped
 * to 90% of the visible viewport and centered on the drop point (or the
 * viewport center), with multi-file batches cascading by a fixed offset.
 * Text takes the clamp on both axes — an estimated box width in place of
 * the parser's wrap sentinel, and a scaled `fontSize`, since neither is
 * derived from the pose the way path geometry is.
 * Multi-root files are wrapped in one synthesized container so a dropped
 * file arrives as a single selectable unit; a single-root file inserts
 * as-is. Each file commits as one `applyOps` batch, so the whole import is
 * a single undo step.
 *
 * Known flattenings (dwarn'd, not fatal): gradient paints collapse to a
 * fallback solid color (the `kit:path` painter takes color strings only).
 */
import { parseSvg } from './parse';
import type { SvgNode, SvgPaint } from './types';
import { UNBOUNDED_TEXT_WIDTH } from './types';
import {
  boundsOfPath,
  createInsertOp,
  dwarn,
  fillToBoundsFrame,
  resolveTextStyle,
  type IngestCtx,
  type NodeFill,
  type Op,
  type TextStyle,
} from '@weasel-js/core';

const CASCADE_OFFSET_PX = 24;
const VIEWPORT_FIT = 0.9;
const GRADIENT_FALLBACK = '#888888';

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
export type SvgSceneDraft =
  | { kind: 'container'; id: string; parentId: string | null; pose: DraftPose }
  | { kind: 'leaf'; id: string; parentId: string | null; pose: DraftPose; data: Record<string, unknown> };

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

/** Lower an `SvgPaint` onto the `kit:path` painter's `NodeFill` — a color
 *  string or a `FillStyle`. `'none'` is meaningful (painter skips the fill).
 *
 *  A gradient rides through as the `FillStyle` it already is, normalized to
 *  the leaf's own box: `objectBoundingBox` gradients already are, and a
 *  `userSpaceOnUse` one is rebased so it survives the fit-clamp and the
 *  drop-point placement that move the geometry out from under it. */
function fillFromPaint(
  paint: SvgPaint | undefined,
  box: SvgDraftBounds,
): NodeFill | undefined {
  if (!paint) return undefined;
  if (paint.kind === 'none') return 'none';
  if (paint.kind === 'solid') return paint.color;
  const g = paint.paint;
  const units = 'units' in g ? g.units : undefined;
  return units === 'world' ? fillToBoundsFrame(g, box) : g;
}

/** Flatten an `SvgPaint` to a color string. Strokes only: the `kit:path`
 *  painter's `data.stroke` is a color, with no slot for a paint server. */
function strokeColorFromPaint(paint: SvgPaint | undefined): string | undefined {
  if (!paint) return undefined;
  if (paint.kind === 'none') return 'none';
  if (paint.kind === 'solid') return paint.color;
  dwarn('ingest', `svg unpack: gradient stroke flattened to ${GRADIENT_FALLBACK}`);
  return GRADIENT_FALLBACK;
}

/**
 * Walk an `SvgNode[]` tree and emit a flat, parent-before-child list of
 * {@link SvgSceneDraft}s. Each `<g>` becomes a container whose pose is the
 * union AABB of its descendants (the kit `group` action's convention);
 * path/text leaves carry kit-painter-native data. Empty groups are dropped.
 */
export function svgNodesToKitDrafts(
  nodes: readonly SvgNode[],
  nextId: () => string,
): SvgSceneDraft[] {
  const drafts: SvgSceneDraft[] = [];

  // Returns the union AABB of the leaves under `n` so a parent container can
  // compose its own pose; null for empty groups.
  const visit = (n: SvgNode, parentId: string | null): SvgDraftBounds | null => {
    if (n.kind === 'group') {
      const draft: Extract<SvgSceneDraft, { kind: 'container' }> = {
        kind: 'container',
        id: nextId(),
        parentId,
        pose: { x: 0, y: 0, width: 0, height: 0 },
      };
      drafts.push(draft);
      let acc: SvgDraftBounds | null = null;
      for (const c of n.children) {
        const b = visit(c, draft.id);
        if (b) acc = acc ? unionRect(acc, b) : b;
      }
      if (!acc) {
        drafts.splice(drafts.indexOf(draft), 1);
        return null;
      }
      draft.pose = acc;
      return acc;
    }

    if (n.kind === 'text') {
      const pose: DraftPose = {
        x: n.x, y: n.y, width: textBoxWidth(n), height: n.height,
      };
      if (n.rotation) pose.rotation = n.rotation;
      drafts.push({
        kind: 'leaf',
        id: nextId(),
        parentId,
        pose,
        data: { text: n.text, ...(n.style ? { style: n.style } : {}) },
      });
      return pose;
    }

    if (n.kind === 'image') {
      const pose: DraftPose = { x: n.x, y: n.y, width: n.width, height: n.height };
      if (n.rotation) pose.rotation = n.rotation;
      drafts.push({
        kind: 'leaf',
        id: nextId(),
        parentId,
        pose,
        data: {
          image: {
            src: n.href,
            ...(n.opacity != null ? { opacity: n.opacity } : {}),
          },
        },
      });
      return pose;
    }

    // Path leaf. Bounds come from the geometry; `pathInPoseFrame` rebases
    // the stored path onto whatever pose box placement settles on.
    const b = n.path.kind === 'rect'
      ? { x: n.path.x, y: n.path.y, width: n.path.width, height: n.path.height }
      : boundsOfPath(n.path);
    const pose: DraftPose = { x: b.x, y: b.y, width: b.width, height: b.height };
    if (n.rotation) pose.rotation = n.rotation;
    const fill = fillFromPaint(n.fill, b);
    const stroke = n.stroke ? strokeColorFromPaint(n.stroke.paint) : undefined;
    drafts.push({
      kind: 'leaf',
      id: nextId(),
      parentId,
      pose,
      data: {
        path: n.path,
        ...(fill !== undefined ? { fill } : {}),
        ...(stroke !== undefined && stroke !== 'none'
          ? { stroke, strokeWidth: n.stroke!.width }
          : {}),
      },
    });
    return pose;
  };

  for (const n of nodes) visit(n, null);
  return drafts;
}

/** Average glyph advance as a fraction of the em, for the width estimate
 *  below. Sans-serif Latin runs 0.5–0.6; erring wide is the safer miss,
 *  since a too-narrow box is the one that clips. */
const ESTIMATED_GLYPH_ADVANCE_EM = 0.6;

/**
 * A finite box width for a text node. External SVG text carries
 * `UNBOUNDED_TEXT_WIDTH` — a wrap sentinel rather than a measurement — and
 * unpack has no text-measure context to replace it with a real one, so it
 * estimates from the longest line. Left alone, the sentinel would swamp the
 * file's union AABB and fit-clamp everything else to a speck.
 */
function textBoxWidth(n: Extract<SvgNode, { kind: 'text' }>): number {
  if (n.width !== UNBOUNDED_TEXT_WIDTH) return n.width;
  const fontSize = resolveTextStyle(n.style).fontSize;
  const longest = n.text.split('\n')
    .reduce((max, line) => Math.max(max, line.length), 0);
  return longest * fontSize * ESTIMATED_GLYPH_ADVANCE_EM;
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
  return {
    ...data,
    style: { ...style, fontSize: resolveTextStyle(style).fontSize * scale },
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
      let drafts = svgNodesToKitDrafts(parsed.nodes, freshSvgNodeId);
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
