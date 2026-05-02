/**
 * Selection overlay — a reusable render layer for drawing selection outlines
 * and corner resize handles in world space.
 *
 * Two pieces:
 *   - `composeSelectionPose` resolves the live pose for a selected id by
 *     consulting the move overlay first, then the resize overlay, then the
 *     stored pose. When a `groupAdapter` is supplied and the id resolves to
 *     a group, the returned pose is the union AABB of all transitive leaf
 *     poses (with the same precedence rules applied per leaf).
 *   - `createSelectionOverlayLayer` returns a `RenderLayer` that draws an
 *     outline + 4 corner handles for each currently-selected id. It can also
 *     accept a `groupAdapter` and resolve group ids to union bounds.
 *
 * Both pieces are domain-agnostic: callers supply pose-shaped values and the
 * layer treats them as plain rectangles.
 *
 * Constraint: when `groupAdapter` is supplied to `composeSelectionPose`, the
 * generic `TPose` must be assignable to `{ x; y; width; height }` because the
 * union AABB needs those fields. The signature enforces this with a type
 * constraint via the `RectPose` bound.
 */

import type { RenderLayer } from './renderLayer';
import type { GroupAdapter } from './groups/types';
import { expandToLeaves } from './groups/resolve';
import { unionBounds } from './groups/unionBounds';
import { applyPaint, applyStroke, alignedStrokeRect, type Paint, type Stroke } from './paint';

interface RectPose {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Options for `composeSelectionPose`. */
export interface ComposeSelectionPoseOpts<TPose> {
  /** Move overlay; when present its `poses` map wins over everything else. */
  moveOverlay?: { poses: Map<string, TPose> } | null;
  /**
   * Resize overlay; consulted only when move overlay does not own the id.
   * For group resize, `leafPoses` (when present) maps each leaf id under the
   * group to its overlay pose. If absent the group falls back to stored
   * leaf poses (defensive — group-resize integration is in flight).
   */
  resizeOverlay?: {
    id: string;
    currentPose: TPose;
    leafPoses?: Map<string, TPose>;
  } | null;
  /** Fallback pose lookup (typically the stored/committed pose). */
  getStoredPose: (id: string) => TPose;
  /**
   * Optional group adapter. When supplied and the queried id is a group,
   * the resolver returns the union AABB of all transitive leaf poses
   * instead of the (non-existent) stored pose for the group id itself.
   * If absent, group ids are treated as opaque leaf ids.
   */
  groupAdapter?: GroupAdapter;
}

/**
 * Build a pose resolver for a selection. Precedence per id:
 * move overlay > resize overlay > stored. When a `groupAdapter` is supplied
 * and the id resolves to a group, the resolver returns the union AABB of
 * all transitive leaf poses (each leaf still subject to the precedence
 * rules). Empty groups resolve to `null`.
 */
export function composeSelectionPose<TPose>(
  opts: ComposeSelectionPoseOpts<TPose>,
): (id: string) => TPose | null {
  const { moveOverlay, resizeOverlay, getStoredPose, groupAdapter } = opts;

  const resolveLeaf = (id: string): TPose => {
    const moved = moveOverlay?.poses.get(id);
    if (moved !== undefined) return moved;
    if (resizeOverlay && resizeOverlay.id === id) return resizeOverlay.currentPose;
    return getStoredPose(id);
  };

  return (id: string): TPose | null => {
    if (groupAdapter !== undefined && groupAdapter.getGroup(id) !== undefined) {
      // Group id — compose union of leaves.
      const leaves = expandToLeaves([id], groupAdapter);
      if (leaves.length === 0) return null;
      const groupResizeLeafPoses =
        resizeOverlay && resizeOverlay.id === id ? resizeOverlay.leafPoses : undefined;
      const leafPoses: TPose[] = [];
      for (const leafId of leaves) {
        const moved = moveOverlay?.poses.get(leafId);
        if (moved !== undefined) {
          leafPoses.push(moved);
          continue;
        }
        const overlayLeaf = groupResizeLeafPoses?.get(leafId);
        if (overlayLeaf !== undefined) {
          leafPoses.push(overlayLeaf);
          continue;
        }
        leafPoses.push(getStoredPose(leafId));
      }
      // Union requires RectPose-shaped data; the public type forbids
      // group resolution otherwise via the layer's bounded generic.
      const u = unionBounds(leafPoses as unknown as RectPose[]);
      if (u === null) return null;
      return u as unknown as TPose;
    }
    return resolveLeaf(id);
  };
}

/** Options for `createSelectionOverlayLayer`. */
export interface SelectionOverlayLayerOpts<TPose extends RectPose> {
  getSelection: () => string[];
  /** Return null to skip rendering for an id (e.g. resolved pose unavailable). */
  getPose: (id: string) => TPose | null;
  /**
   * Optional group adapter. When supplied, any id that resolves to a group
   * is rendered as a single rectangle covering the union bounds of all its
   * transitive leaves (using `getPose` to look up each leaf).
   */
  groupAdapter?: GroupAdapter;
  /** Outline stroke style + outset distance from the pose rect. */
  outline?: Stroke & { pad?: number };
  /** Handle visuals; pass `false` to render outlines only. */
  handles?:
    | {
        size?: number;
        fill?: Paint;
        outline?: Stroke;
      }
    | false;
  /** Override handle placement. Default: 4 corners. Each point is a center. */
  handlesOf?: (pose: TPose) => { x: number; y: number }[];
}

const DEFAULT_OUTLINE: Required<Pick<Stroke, 'paint' | 'width'>> & { pad: number } = {
  paint: { kind: 'solid', color: '#f0e0a8' },
  width: 2,
  pad: 1,
};
const DEFAULT_HANDLE_FILL: Paint = { kind: 'solid', color: '#d4c4a8' };
const DEFAULT_HANDLE_OUTLINE: Stroke = {
  paint: { kind: 'solid', color: '#1a130d' },
  width: 1,
};
const DEFAULT_HANDLE_SIZE = 8;

function defaultHandlesOf(p: RectPose): { x: number; y: number }[] {
  return [
    { x: p.x, y: p.y },
    { x: p.x + p.width, y: p.y },
    { x: p.x, y: p.y + p.height },
    { x: p.x + p.width, y: p.y + p.height },
  ];
}

/**
 * Create a `RenderLayer` that draws selection outlines and corner handles.
 * The layer renders in world space — i.e. it assumes the caller's render
 * pipeline has already applied any view transform to the canvas context.
 */
export function createSelectionOverlayLayer<TPose extends RectPose>(
  opts: SelectionOverlayLayerOpts<TPose>,
): RenderLayer<unknown> {
  const outlineOpts = opts.outline;
  const outlineStroke: Stroke = outlineOpts
    ? {
        paint: outlineOpts.paint,
        width: outlineOpts.width ?? DEFAULT_OUTLINE.width,
        dash: outlineOpts.dash,
        cap: outlineOpts.cap,
        join: outlineOpts.join,
        align: outlineOpts.align,
      }
    : { paint: DEFAULT_OUTLINE.paint, width: DEFAULT_OUTLINE.width };
  const outlinePad = outlineOpts?.pad ?? DEFAULT_OUTLINE.pad;
  const handlesEnabled = opts.handles !== false;
  const handlesCfg = handlesEnabled && opts.handles !== false ? opts.handles ?? {} : null;
  const handles = handlesCfg
    ? {
        size: handlesCfg.size ?? DEFAULT_HANDLE_SIZE,
        fill: handlesCfg.fill ?? DEFAULT_HANDLE_FILL,
        outline: handlesCfg.outline ?? DEFAULT_HANDLE_OUTLINE,
      }
    : null;
  const handlesOf = opts.handlesOf ?? defaultHandlesOf;
  const { groupAdapter } = opts;

  // When a group adapter is supplied, group ids resolve to a union AABB
  // computed from each transitive leaf's pose. The outline+handles still
  // draw a single rect (the union), matching how leaves render.
  const resolvePose = (id: string): TPose | null => {
    if (groupAdapter !== undefined && groupAdapter.getGroup(id) !== undefined) {
      const leaves = expandToLeaves([id], groupAdapter);
      if (leaves.length === 0) return null;
      const leafPoses: TPose[] = [];
      for (const leafId of leaves) {
        const p = opts.getPose(leafId);
        if (p !== null) leafPoses.push(p);
      }
      if (leafPoses.length === 0) return null;
      const u = unionBounds(leafPoses);
      if (u === null) return null;
      return u as TPose;
    }
    return opts.getPose(id);
  };

  return {
    id: 'selection-overlay',
    label: 'Selection',
    draw: (ctx: CanvasRenderingContext2D) => {
      const ids = opts.getSelection();
      if (ids.length === 0) return;

      // Outlines first, handles second — matches the stacking order the demo
      // and production app already use.
      ctx.save();
      applyStroke(ctx, outlineStroke);
      const pad = outlinePad;
      const align = outlineStroke.align ?? 'center';
      const width = outlineStroke.width ?? 1;
      for (const id of ids) {
        const p = resolvePose(id);
        if (!p) continue;
        const padded = {
          x: p.x - pad,
          y: p.y - pad,
          width: p.width + pad * 2,
          height: p.height + pad * 2,
        };
        const r = alignedStrokeRect(padded, align, width);
        ctx.strokeRect(r.x, r.y, r.width, r.height);
      }
      ctx.restore();

      if (!handles) return;

      const half = handles.size / 2;
      const handleAlign = handles.outline.align ?? 'center';
      const handleWidth = handles.outline.width ?? 1;
      for (const id of ids) {
        const p = resolvePose(id);
        if (!p) continue;
        for (const h of handlesOf(p)) {
          const baseRect = {
            x: h.x - half,
            y: h.y - half,
            width: handles.size,
            height: handles.size,
          };
          ctx.save();
          applyPaint(ctx, handles.fill, { x: baseRect.x, y: baseRect.y });
          ctx.fillRect(baseRect.x, baseRect.y, baseRect.width, baseRect.height);
          applyStroke(ctx, handles.outline, { x: baseRect.x, y: baseRect.y });
          const sr = alignedStrokeRect(baseRect, handleAlign, handleWidth);
          ctx.strokeRect(sr.x, sr.y, sr.width, sr.height);
          ctx.restore();
        }
      }
    },
  };
}
