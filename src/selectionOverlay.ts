/**
 * Selection overlay primitives — render layers for drawing selection
 * outlines and corner resize handles in world space.
 *
 * Three pieces:
 *   - `composeSelectionPose` resolves the live pose for a selected id by
 *     consulting the move overlay first, then the resize overlay, then the
 *     stored pose. When a `groupAdapter` is supplied and the id resolves to
 *     a group, the returned pose is the union AABB of all transitive leaf
 *     poses (with the same precedence rules applied per leaf).
 *   - `createSelectionOutlineLayer` draws the outline rect for each selected
 *     id (group ids resolve to a union AABB via the optional `groupAdapter`).
 *   - `createSelectionHandlesLayer` draws resize-handle rects (default 4
 *     corners) for each selected id, with the same group-resolution rules.
 *
 * `createSelectionOverlayLayer` is a thin convenience that returns a single
 * `RenderLayer` whose draw runs the outline pass then the handles pass —
 * matches what most callers want and keeps existing call sites working.
 *
 * All pieces are domain-agnostic: callers supply pose-shaped values and the
 * layers treat them as plain rectangles.
 *
 * Constraint: when `groupAdapter` is supplied, the generic `TPose` must be
 * assignable to `{ x; y; width; height }` because the union AABB needs those
 * fields. The signatures enforce this with a type constraint via the
 * `RectPose` bound.
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
      const u = unionBounds(leafPoses as unknown as RectPose[]);
      if (u === null) return null;
      return u as unknown as TPose;
    }
    return resolveLeaf(id);
  };
}

/**
 * Build a pose resolver that handles group ids by computing the union AABB
 * of every leaf's pose (looked up via `getPose`). Non-group ids pass through
 * directly. When `groupAdapter` is omitted, every id is treated as a leaf.
 */
function makeGroupAwarePoseResolver<TPose extends RectPose>(
  getPose: (id: string) => TPose | null,
  groupAdapter?: GroupAdapter,
): (id: string) => TPose | null {
  if (groupAdapter === undefined) return getPose;
  return (id: string): TPose | null => {
    if (groupAdapter.getGroup(id) === undefined) return getPose(id);
    const leaves = expandToLeaves([id], groupAdapter);
    if (leaves.length === 0) return null;
    const leafPoses: TPose[] = [];
    for (const leafId of leaves) {
      const p = getPose(leafId);
      if (p !== null) leafPoses.push(p);
    }
    if (leafPoses.length === 0) return null;
    const u = unionBounds(leafPoses);
    if (u === null) return null;
    return u as TPose;
  };
}

/** Shared options between outline and handles layers. */
interface SelectionLayerCommon<TPose extends RectPose> {
  getSelection: () => string[];
  /** Return null to skip rendering for an id (e.g. resolved pose unavailable). */
  getPose: (id: string) => TPose | null;
  /**
   * Optional group adapter. When supplied, any id that resolves to a group
   * is rendered using the union bounds of all its transitive leaves.
   */
  groupAdapter?: GroupAdapter;
}

/** Options for `createSelectionOutlineLayer`. */
export interface SelectionOutlineLayerOpts<TPose extends RectPose>
  extends SelectionLayerCommon<TPose> {
  /** Outline stroke style + outset distance from the pose rect. */
  outline?: Stroke & { pad?: number };
}

/** Options for `createSelectionHandlesLayer`. */
export interface SelectionHandlesLayerOpts<TPose extends RectPose>
  extends SelectionLayerCommon<TPose> {
  /** Handle visuals. Omit for defaults. */
  handles?: {
    size?: number;
    fill?: Paint;
    outline?: Stroke;
  };
  /** Override handle placement. Default: 4 corners. Each point is a center. */
  handlesOf?: (pose: TPose) => { x: number; y: number }[];
}

/** Options for `createSelectionOverlayLayer`. */
export interface SelectionOverlayLayerOpts<TPose extends RectPose>
  extends SelectionLayerCommon<TPose> {
  outline?: Stroke & { pad?: number };
  /** Pass `false` to render outlines only. */
  handles?:
    | {
        size?: number;
        fill?: Paint;
        outline?: Stroke;
      }
    | false;
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

function resolveOutlineStroke(opts?: Stroke & { pad?: number }): {
  stroke: Stroke;
  pad: number;
} {
  if (!opts) {
    return {
      stroke: { paint: DEFAULT_OUTLINE.paint, width: DEFAULT_OUTLINE.width },
      pad: DEFAULT_OUTLINE.pad,
    };
  }
  return {
    stroke: {
      paint: opts.paint,
      width: opts.width ?? DEFAULT_OUTLINE.width,
      dash: opts.dash,
      cap: opts.cap,
      join: opts.join,
      align: opts.align,
    },
    pad: opts.pad ?? DEFAULT_OUTLINE.pad,
  };
}

function drawOutlines<TPose extends RectPose>(
  ctx: CanvasRenderingContext2D,
  ids: string[],
  resolvePose: (id: string) => TPose | null,
  stroke: Stroke,
  pad: number,
): void {
  ctx.save();
  applyStroke(ctx, stroke);
  const align = stroke.align ?? 'center';
  const width = stroke.width ?? 1;
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
}

interface ResolvedHandles {
  size: number;
  fill: Paint;
  outline: Stroke;
}

function resolveHandles(opts?: SelectionHandlesLayerOpts<RectPose>['handles']): ResolvedHandles {
  return {
    size: opts?.size ?? DEFAULT_HANDLE_SIZE,
    fill: opts?.fill ?? DEFAULT_HANDLE_FILL,
    outline: opts?.outline ?? DEFAULT_HANDLE_OUTLINE,
  };
}

function drawHandles<TPose extends RectPose>(
  ctx: CanvasRenderingContext2D,
  ids: string[],
  resolvePose: (id: string) => TPose | null,
  handles: ResolvedHandles,
  handlesOf: (p: TPose) => { x: number; y: number }[],
): void {
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
}

/**
 * `RenderLayer` that draws selection outlines only. Stack alongside
 * `createSelectionHandlesLayer` (or just use `createSelectionOverlayLayer`
 * for the common case) when both passes are wanted.
 */
export function createSelectionOutlineLayer<TPose extends RectPose>(
  opts: SelectionOutlineLayerOpts<TPose>,
): RenderLayer<unknown> {
  const { stroke, pad } = resolveOutlineStroke(opts.outline);
  const resolvePose = makeGroupAwarePoseResolver(opts.getPose, opts.groupAdapter);
  return {
    id: 'selection-outline',
    label: 'Selection outline',
    draw: (ctx) => {
      const ids = opts.getSelection();
      if (ids.length === 0) return;
      drawOutlines(ctx, ids, resolvePose, stroke, pad);
    },
  };
}

/**
 * `RenderLayer` that draws selection handles only. Stack on top of
 * `createSelectionOutlineLayer` (handles render on top of the outline).
 */
export function createSelectionHandlesLayer<TPose extends RectPose>(
  opts: SelectionHandlesLayerOpts<TPose>,
): RenderLayer<unknown> {
  const handles = resolveHandles(opts.handles);
  const handlesOf = opts.handlesOf ?? (defaultHandlesOf as (p: TPose) => { x: number; y: number }[]);
  const resolvePose = makeGroupAwarePoseResolver(opts.getPose, opts.groupAdapter);
  return {
    id: 'selection-handles',
    label: 'Selection handles',
    draw: (ctx) => {
      const ids = opts.getSelection();
      if (ids.length === 0) return;
      drawHandles(ctx, ids, resolvePose, handles, handlesOf);
    },
  };
}

/**
 * Convenience wrapper that draws outlines then handles in a single layer.
 * Equivalent to stacking `createSelectionOutlineLayer` and
 * `createSelectionHandlesLayer` in `runLayers`. Pass `handles: false` to
 * render outlines only.
 */
export function createSelectionOverlayLayer<TPose extends RectPose>(
  opts: SelectionOverlayLayerOpts<TPose>,
): RenderLayer<unknown> {
  const { stroke, pad } = resolveOutlineStroke(opts.outline);
  const handlesEnabled = opts.handles !== false;
  const handles = handlesEnabled ? resolveHandles(opts.handles || undefined) : null;
  const handlesOf = opts.handlesOf ?? (defaultHandlesOf as (p: TPose) => { x: number; y: number }[]);
  const resolvePose = makeGroupAwarePoseResolver(opts.getPose, opts.groupAdapter);

  return {
    id: 'selection-overlay',
    label: 'Selection',
    draw: (ctx) => {
      const ids = opts.getSelection();
      if (ids.length === 0) return;
      drawOutlines(ctx, ids, resolvePose, stroke, pad);
      if (!handles) return;
      drawHandles(ctx, ids, resolvePose, handles, handlesOf);
    },
  };
}
