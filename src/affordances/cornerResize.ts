import type { Affordance, AffordanceBinding, AffordanceRegion } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { DragChannel } from 'tools/types';
import type { ResizeAnchor } from 'interactions/gestures/types';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/useSelectTool';

export interface CornerResizeAffordanceOptions {
  /** Hit radius (screen-px) for the corner handles. Default 8. */
  handleHitRadius?: number;
  /** Visual handle size (screen-px). Default 8. */
  handleSize?: number;
  fill?: string;
  stroke?: string;
}

export interface CornerResizeScratch {
  /** Resize anchor identifying the OPPOSITE corner (the one that stays
   *  fixed). Matches the kit's existing ResizeAnchor convention. */
  anchor: ResizeAnchor;
  /** Id of the resize target. In multi-mode this is `MULTI_RESIZE_TARGET_ID`. */
  targetId: string;
}

const DEFAULT_FILL = '#d4c4a8';
const DEFAULT_STROKE = '#1a130d';

const stubDrag: DragChannel<CornerResizeScratch> = {
  onStart: () => 'claim',
  onMove: () => 'claim',
  onEnd: () => 'claim',
  onCancel: () => {},
};

/**
 * @experimental
 * Corner-handle affordance for resizing the active selection (single
 * member in single-mode; the union AABB in multi-mode).
 *
 * Declares four point regions in the target's local frame; the framework
 * applies the target's bounds rotation for both paint and hit-test. The
 * drag channel returned here is a no-op stub that claims — consuming
 * tools (`useResizeTool`) wrap each region's `bind()` to substitute a
 * drag channel that drives `useResize`.
 */
export function createCornerResizeAffordance(
  opts: CornerResizeAffordanceOptions = {},
): Affordance {
  const {
    handleHitRadius = 8,
    handleSize = 8,
    fill = DEFAULT_FILL,
    stroke = DEFAULT_STROKE,
  } = opts;

  const paint = {
    kind: 'square' as const,
    sizePx: handleSize,
    fill: { color: fill },
    stroke: { paint: { color: stroke }, width: 1 },
  };

  return {
    id: 'corner-resize',
    regions(state: ChromeState): readonly AffordanceRegion[] {
      const target = pickRenderTarget(state);
      if (!target) return [];
      const b = target.bounds;
      const corners: { lx: number; ly: number; anchor: ResizeAnchor; tag: string }[] = [
        { lx: b.x,           ly: b.y,            anchor: { x: 'max', y: 'max' }, tag: 'min-min' },
        { lx: b.x + b.width, ly: b.y,            anchor: { x: 'min', y: 'max' }, tag: 'max-min' },
        { lx: b.x,           ly: b.y + b.height, anchor: { x: 'max', y: 'min' }, tag: 'min-max' },
        { lx: b.x + b.width, ly: b.y + b.height, anchor: { x: 'min', y: 'min' }, tag: 'max-max' },
      ];
      return corners.map(({ lx, ly, anchor, tag }) => ({
        id: `corner-${tag}`,
        targetId: target.id,
        shape: { kind: 'point' as const, x: lx, y: ly, hitRadiusPx: handleHitRadius },
        paint,
        bind: (): AffordanceBinding => ({
          drag: stubDrag as unknown as AffordanceBinding['drag'],
          initialScratch: { anchor, targetId: target.id } satisfies CornerResizeScratch,
        }),
      } satisfies AffordanceRegion));
    },
  };
}

function pickRenderTarget(state: ChromeState): { id: string; bounds: Bounds } | null {
  if (state.multiActive && state.unionBounds) {
    return { id: MULTI_RESIZE_TARGET_ID, bounds: state.unionBounds };
  }
  if (state.selection.length === 1) {
    const id = state.selection[0];
    const b = state.boundsOf(id);
    return b ? { id, bounds: b } : null;
  }
  return null;
}
