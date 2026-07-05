/**
 * The `unpack` half of the kit SVG handler (`svgHandler.ts`): parse an SVG
 * file into **native scene nodes** — path/text leaves under containers that
 * mirror the source `<g>` structure — instead of the default single
 * embedded-image node. Opted into via
 * `<SceneCanvas ingestion={{ svg: { unpack: true } }}>`.
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
 * Multi-root files are wrapped in one synthesized container so a dropped
 * file arrives as a single selectable unit; a single-root file inserts
 * as-is. Each file commits as one `applyOps` batch, so the whole import is
 * a single undo step.
 *
 * Known flattenings (dwarn'd, not fatal): gradient paints collapse to a
 * fallback solid color (the `kit:path` painter takes color strings only),
 * and text `fontSize` does not participate in the fit-clamp scale.
 */
import { parseSvg, type SvgNode, type SvgPaint } from '@weasel-js/svg';
import { boundsOfPath } from 'features/paths/bounds';
import { createInsertOp } from 'core/ops/create';
import type { Op } from 'core/ops/types';
import { dwarn } from '../../debug';
import type { IngestCtx } from './contentHandlers';

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

/** Flatten an `SvgPaint` to the `kit:path` painter's color-string contract.
 *  `'none'` is meaningful (painter skips the fill); gradients collapse to a
 *  fallback solid — the painter's data contract has no gradient slot yet. */
function colorFromPaint(paint: SvgPaint | undefined, context: string): string | undefined {
  if (!paint) return undefined;
  if (paint.kind === 'none') return 'none';
  if (paint.kind === 'solid') return paint.color;
  dwarn('ingest', `svg unpack: gradient ${context} flattened to ${GRADIENT_FALLBACK}`);
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
      const pose: DraftPose = { x: n.x, y: n.y, width: n.width, height: n.height };
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

    // Path leaf. Bounds come from the geometry; `pathInPoseFrame` rebases
    // the stored path onto whatever pose box placement settles on.
    const b = n.path.kind === 'rect'
      ? { x: n.path.x, y: n.path.y, width: n.path.width, height: n.path.height }
      : boundsOfPath(n.path);
    const pose: DraftPose = { x: b.x, y: b.y, width: b.width, height: b.height };
    if (n.rotation) pose.rotation = n.rotation;
    const fill = colorFromPaint(n.fill, 'fill');
    const stroke = n.stroke ? colorFromPaint(n.stroke.paint, 'stroke') : undefined;
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
            data: d.kind === 'leaf' ? d.data : {},
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
