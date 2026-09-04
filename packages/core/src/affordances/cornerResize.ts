import type { Affordance, AffordanceBinding, AffordanceRegion, CommonAffordanceScratch } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { ResizeAnchor } from 'interactions/gestures/types';
import { CORNER_ANCHORS, cornerPoint, fixedCornerOf } from 'interactions/actions/resize/cornerHandles';
import { MULTI_RESIZE_TARGET_ID } from 'core/selection/selectionTarget';
import { angleOf, localToWorld, transformOf } from './hitAffordanceRegions';
import { HANDLE_BASE_PX } from 'core/device/targets';

/** Options for `createCornerResizeAffordance` — the size and appearance of
 *  the corner handles. */
export interface CornerResizeAffordanceOptions {
  /** Hit radius (screen-px) for the corner handles. Default 8. */
  handleHitRadius?: number;
  /** Visual handle size (screen-px). Default 8. */
  handleSize?: number;
  fill?: string;
  stroke?: string;
}

/** What a corner-resize hit hands to the resize action: which corner stays
 *  put, what is being resized, and the world-space pivot to scale from. */
export interface CornerResizeScratch extends CommonAffordanceScratch {
  /** Resize anchor identifying the OPPOSITE corner (the one that stays
   *  fixed). Matches the kit's existing ResizeAnchor convention. */
  anchor: ResizeAnchor;
  /** Id of the resize target. In multi-mode this is `MULTI_RESIZE_TARGET_ID`. */
  targetId: string;
  /** The fixed corner in **world** coords, with the target's rotation already
   *  applied. `resizeAction` scales from this point, and it has no access to
   *  the target transform, so the affordance resolves it here. */
  fixedPoint: { x: number; y: number };
}

const DEFAULT_FILL = '#d4c4a8';
const DEFAULT_STROKE = '#1a130d';

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
    handleHitRadius = HANDLE_BASE_PX,
    handleSize = HANDLE_BASE_PX,
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
    id: 'selection.resize-handles',
    regions(state: ChromeState): readonly AffordanceRegion[] {
      const target = pickRenderTarget(state);
      if (!target) return [];
      const b = target.bounds;
      // The transform the framework applies to these regions. Needed here too,
      // because `fixedPoint` leaves the local frame — it travels to
      // `resizeAction`, which works in world coords.
      const xf = transformOf(state, target.id);
      return CORNER_ANCHORS.map((c) => {
        const corner = cornerPoint(b, c);
        const fixedLocal = fixedCornerOf(b, c.anchor);
        const fixedPoint = localToWorld(xf, fixedLocal.x, fixedLocal.y);
        return {
          id: `corner-${c.tag}`,
          targetId: target.id,
          shape: { kind: 'point' as const, x: corner.x, y: corner.y, hitRadiusPx: handleHitRadius },
          paint,
          hitKind: c.kind,
          // Diagonal by fixed-corner parity: a matched-axis anchor (min-min /
          // max-max fixed) means the dragged corner sits on the ↘ diagonal;
          // mixed axes sit on the ↗ diagonal. The glyph is horizontal at angle
          // 0, so the diagonal is a half-quarter-turn either way, plus the
          // target's own rotation. The keyword is the fallback rather than the
          // answer: CSS has four of them, which cannot express a target
          // rotated to anything but a multiple of 45°.
          cursor: {
            glyph: 'resize',
            angle: (c.anchor.x === c.anchor.y ? Math.PI / 4 : -Math.PI / 4) + angleOf(xf),
            fallback: c.anchor.x === c.anchor.y ? 'nwse-resize' : 'nesw-resize',
          },
          bind: (): AffordanceBinding => ({
            initialScratch: {
              anchor: c.anchor,
              targetId: target.id,
              fixedPoint,
            } satisfies CornerResizeScratch,
          }),
        } satisfies AffordanceRegion;
      });
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
