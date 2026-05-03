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
 * `RenderLayer` whose draw runs the outline pass then the handles pass.
 *
 * **Pose shape:** TPose is generic; callers must supply `getBounds(pose)`
 * to project any pose into the AABB the renderer needs. For rect-shaped
 * poses (`{x, y, width, height}`) pass the identity. For `Path` poses pass
 * `boundsOfPath`. Group ids reduce via `unionBounds` over the projected
 * AABBs.
 */

import type { RenderLayer } from '../../core/layers/render';
import type { GroupAdapter } from '../groups/types';
import { expandToLeaves } from '../groups/resolve';
import { unionBounds } from '../groups/unionBounds';
import { applyPaint, applyStroke, alignedStrokeRect, type Paint, type Stroke } from '../../core/paint';

interface Bounds {
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
   * Project a pose into its AABB. Used when reducing a group of leaf poses
   * into a single union AABB. Defaults to the identity — rect-shaped poses
   * (`{x, y, width, height}`) need no override. For `Path` poses pass
   * `boundsOfPath`.
   */
  getBounds?: (pose: TPose) => Bounds;
  /**
   * Wrap an AABB back into a TPose. Called only when the resolver collapses
   * a group's leaves into a single union AABB. Defaults to the identity —
   * for `Path` poses pass `(b) => ({ kind: 'rect', ...b })`.
   */
  fromBounds?: (bounds: Bounds) => TPose;
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
  const getBounds = opts.getBounds ?? ((pose: TPose) => pose as unknown as Bounds);
  const fromBounds = opts.fromBounds ?? ((bounds: Bounds) => bounds as unknown as TPose);

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
      const leafBounds: Bounds[] = [];
      for (const leafId of leaves) {
        const moved = moveOverlay?.poses.get(leafId);
        if (moved !== undefined) {
          leafBounds.push(getBounds(moved));
          continue;
        }
        const overlayLeaf = groupResizeLeafPoses?.get(leafId);
        if (overlayLeaf !== undefined) {
          leafBounds.push(getBounds(overlayLeaf));
          continue;
        }
        leafBounds.push(getBounds(getStoredPose(leafId)));
      }
      const u = unionBounds(leafBounds);
      if (u === null) return null;
      return fromBounds(u);
    }
    return resolveLeaf(id);
  };
}

/**
 * Build a pose resolver that handles group ids by computing the union AABB
 * of every leaf's bounds. Non-group ids pass through directly. When
 * `groupAdapter` is omitted, every id is treated as a leaf.
 */
function makeGroupAwareBoundsResolver<TPose>(
  getPose: (id: string) => TPose | null,
  getBounds: (pose: TPose) => Bounds,
  groupAdapter?: GroupAdapter,
): (id: string) => Bounds | null {
  if (groupAdapter === undefined) {
    return (id: string) => {
      const p = getPose(id);
      return p === null ? null : getBounds(p);
    };
  }
  return (id: string): Bounds | null => {
    if (groupAdapter.getGroup(id) === undefined) {
      const p = getPose(id);
      return p === null ? null : getBounds(p);
    }
    const leaves = expandToLeaves([id], groupAdapter);
    if (leaves.length === 0) return null;
    const leafBounds: Bounds[] = [];
    for (const leafId of leaves) {
      const p = getPose(leafId);
      if (p !== null) leafBounds.push(getBounds(p));
    }
    if (leafBounds.length === 0) return null;
    return unionBounds(leafBounds);
  };
}

/** Shared options between outline and handles layers. */
interface SelectionLayerCommon<TPose> {
  getSelection: () => string[];
  /** Return null to skip rendering for an id (e.g. resolved pose unavailable). */
  getPose: (id: string) => TPose | null;
  /**
   * Project a pose into its AABB. Defaults to the identity — rect-shaped
   * poses (`{x, y, width, height}`) need no override. For `Path` poses pass
   * `boundsOfPath`.
   */
  getBounds?: (pose: TPose) => Bounds;
  /**
   * Optional group adapter. When supplied, any id that resolves to a group
   * is rendered using the union bounds of all its transitive leaves.
   */
  groupAdapter?: GroupAdapter;
}

/** Options for `createSelectionOutlineLayer`. */
export interface SelectionOutlineLayerOpts<TPose> extends SelectionLayerCommon<TPose> {
  /** Outline stroke style + outset distance from the pose rect. */
  outline?: Stroke & { pad?: number };
}

/** Options for `createSelectionHandlesLayer`. */
export interface SelectionHandlesLayerOpts<TPose> extends SelectionLayerCommon<TPose> {
  /** Handle visuals. Omit for defaults. */
  handles?: {
    size?: number;
    fill?: Paint;
    outline?: Stroke;
  };
  /** Override handle placement. Default: 4 corners of the AABB. */
  handlesOf?: (bounds: Bounds) => { x: number; y: number }[];
}

/** Options for `createSelectionOverlayLayer`. */
export interface SelectionOverlayLayerOpts<TPose> extends SelectionLayerCommon<TPose> {
  outline?: Stroke & { pad?: number };
  /** Pass `false` to render outlines only. */
  handles?:
    | {
        size?: number;
        fill?: Paint;
        outline?: Stroke;
      }
    | false;
  handlesOf?: (bounds: Bounds) => { x: number; y: number }[];
}

const DEFAULT_OUTLINE: Required<Pick<Stroke, 'paint' | 'width'>> & { pad: number } = {
  paint: { fill: 'solid', color: '#f0e0a8' },
  width: 2,
  pad: 1,
};
const DEFAULT_HANDLE_FILL: Paint = { fill: 'solid', color: '#d4c4a8' };
const DEFAULT_HANDLE_OUTLINE: Stroke = {
  paint: { fill: 'solid', color: '#1a130d' },
  width: 1,
};
const DEFAULT_HANDLE_SIZE = 8;

function defaultHandlesOf(b: Bounds): { x: number; y: number }[] {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x, y: b.y + b.height },
    { x: b.x + b.width, y: b.y + b.height },
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

function drawOutlines(
  ctx: CanvasRenderingContext2D,
  ids: string[],
  resolveBounds: (id: string) => Bounds | null,
  stroke: Stroke,
  pad: number,
): void {
  ctx.save();
  applyStroke(ctx, stroke);
  const align = stroke.align ?? 'center';
  const width = stroke.width ?? 1;
  for (const id of ids) {
    const b = resolveBounds(id);
    if (!b) continue;
    const padded = {
      x: b.x - pad,
      y: b.y - pad,
      width: b.width + pad * 2,
      height: b.height + pad * 2,
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

function resolveHandles(opts?: SelectionHandlesLayerOpts<unknown>['handles']): ResolvedHandles {
  return {
    size: opts?.size ?? DEFAULT_HANDLE_SIZE,
    fill: opts?.fill ?? DEFAULT_HANDLE_FILL,
    outline: opts?.outline ?? DEFAULT_HANDLE_OUTLINE,
  };
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  ids: string[],
  resolveBounds: (id: string) => Bounds | null,
  handles: ResolvedHandles,
  handlesOf: (b: Bounds) => { x: number; y: number }[],
): void {
  const half = handles.size / 2;
  const handleAlign = handles.outline.align ?? 'center';
  const handleWidth = handles.outline.width ?? 1;
  for (const id of ids) {
    const b = resolveBounds(id);
    if (!b) continue;
    for (const h of handlesOf(b)) {
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
export function createSelectionOutlineLayer<TPose>(
  opts: SelectionOutlineLayerOpts<TPose>,
): RenderLayer<unknown> {
  const { stroke, pad } = resolveOutlineStroke(opts.outline);
  const getBounds = opts.getBounds ?? ((pose: TPose) => pose as unknown as Bounds);
  const resolveBounds = makeGroupAwareBoundsResolver(opts.getPose, getBounds, opts.groupAdapter);
  return {
    id: 'selection-outline',
    label: 'Selection outline',
    draw: (ctx) => {
      const ids = opts.getSelection();
      if (ids.length === 0) return;
      drawOutlines(ctx, ids, resolveBounds, stroke, pad);
    },
  };
}

/**
 * `RenderLayer` that draws selection handles only. Stack on top of
 * `createSelectionOutlineLayer` (handles render on top of the outline).
 */
export function createSelectionHandlesLayer<TPose>(
  opts: SelectionHandlesLayerOpts<TPose>,
): RenderLayer<unknown> {
  const handles = resolveHandles(opts.handles);
  const handlesOf = opts.handlesOf ?? defaultHandlesOf;
  const getBounds = opts.getBounds ?? ((pose: TPose) => pose as unknown as Bounds);
  const resolveBounds = makeGroupAwareBoundsResolver(opts.getPose, getBounds, opts.groupAdapter);
  return {
    id: 'selection-handles',
    label: 'Selection handles',
    draw: (ctx) => {
      const ids = opts.getSelection();
      if (ids.length === 0) return;
      drawHandles(ctx, ids, resolveBounds, handles, handlesOf);
    },
  };
}

/**
 * Convenience wrapper that draws outlines then handles in a single layer.
 * Equivalent to stacking `createSelectionOutlineLayer` and
 * `createSelectionHandlesLayer` in `runLayers`. Pass `handles: false` to
 * render outlines only.
 */
export function createSelectionOverlayLayer<TPose>(
  opts: SelectionOverlayLayerOpts<TPose>,
): RenderLayer<unknown> {
  const { stroke, pad } = resolveOutlineStroke(opts.outline);
  const handlesEnabled = opts.handles !== false;
  const handles = handlesEnabled ? resolveHandles(opts.handles || undefined) : null;
  const handlesOf = opts.handlesOf ?? defaultHandlesOf;
  const getBounds = opts.getBounds ?? ((pose: TPose) => pose as unknown as Bounds);
  const resolveBounds = makeGroupAwareBoundsResolver(opts.getPose, getBounds, opts.groupAdapter);

  return {
    id: 'selection-overlay',
    label: 'Selection',
    draw: (ctx) => {
      const ids = opts.getSelection();
      if (ids.length === 0) return;
      drawOutlines(ctx, ids, resolveBounds, stroke, pad);
      if (!handles) return;
      drawHandles(ctx, ids, resolveBounds, handles, handlesOf);
    },
  };
}
