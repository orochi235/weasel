import type { Affordance, AffordanceBinding, AffordanceRegion, CommonAffordanceScratch } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { ResizeAnchor } from 'interactions/gestures/types';
import {
  RESIZE_HANDLE_ANCHORS, fixedCornerOf, handlePoint, isCornerHandle, type ResizeHandleAnchor,
} from 'interactions/actions/resize/cornerHandles';
import { MULTI_RESIZE_TARGET_ID } from 'core/selection/selectionTarget';
import { localToWorld, transformOf, type TargetTransform } from './hitAffordanceRegions';
import type { View } from 'core/viewport/view';
import { HANDLE_BASE_PX } from 'core/device/targets';
import type { CursorSpec } from '@weasel-js/cursor';

/** Options for `createCornerResizeAffordance` — the size and appearance of
 *  the resize handles, and whether the edge midpoints get one. */
export interface CornerResizeAffordanceOptions {
  /** Hit radius (screen-px) for the handles. Default 8. */
  handleHitRadius?: number;
  /** Visual handle size (screen-px). Default 8. */
  handleSize?: number;
  fill?: string;
  stroke?: string;
  /** Add a handle at the middle of each edge, resizing along one axis with
   *  the opposite edge pinned. A side under `EDGE_HANDLE_MIN_RADII` hit radii
   *  on screen takes none. Default true. */
  edges?: boolean;
}

/** What a corner-resize hit hands to the resize action: which corner stays
 *  put, what is being resized, and the world-space pivot to scale from. */
export interface CornerResizeScratch extends CommonAffordanceScratch {
  /** Resize anchor identifying the OPPOSITE corner or edge (the one that
   *  stays fixed). Matches the kit's existing ResizeAnchor convention. */
  anchor: ResizeAnchor;
  /** Id of the resize target. In multi-mode this is `MULTI_RESIZE_TARGET_ID`. */
  targetId: string;
  /** The fixed corner (an edge handle's: the opposite edge's midpoint) in
   *  **world** coords, with the target's rotation already applied. `resizeAction` scales from this point, and it has no access to
   *  the target transform, so the affordance resolves it here. */
  fixedPoint: { x: number; y: number };
}

const DEFAULT_FILL = '#d4c4a8';
const DEFAULT_STROKE = '#1a130d';

/**
 * Resize-handle affordance for the active selection (single member in
 * single-mode; the union AABB in multi-mode): a handle at each corner and,
 * unless `edges` is false, at each edge midpoint.
 *
 * Declares point regions in the target's local frame; the framework
 * applies the target's bounds rotation for both paint and hit-test. A
 * region's `bind()` carries only the scratch a hit hands to the resize
 * action: the anchor, the target, and the world-space fixed point.
 */
export function createCornerResizeAffordance(
  opts: CornerResizeAffordanceOptions = {},
): Affordance {
  const {
    handleHitRadius = HANDLE_BASE_PX,
    handleSize = HANDLE_BASE_PX,
    fill = DEFAULT_FILL,
    stroke = DEFAULT_STROKE,
    edges = true,
  } = opts;
  const entries = edges ? RESIZE_HANDLE_ANCHORS : RESIZE_HANDLE_ANCHORS.filter(isCornerHandle);

  const paint = {
    kind: 'square' as const,
    sizePx: handleSize,
    fill: { paint: { color: fill } },
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
      return entries.map((c) => {
        const at = handlePoint(b, c);
        const fixedLocal = fixedCornerOf(b, c.anchor);
        const fixedPoint = localToWorld(xf, fixedLocal.x, fixedLocal.y);
        const corner = isCornerHandle(c);
        return {
          id: `${corner ? 'corner' : 'edge'}-${c.tag}`,
          targetId: target.id,
          shape: {
            kind: 'point' as const,
            x: at.x,
            y: at.y,
            hitRadiusPx: handleHitRadius,
            turned: true,
            ...(corner
              ? {
                  cornerOf: {
                    width: b.width,
                    height: b.height,
                    outward: { x: c.xEdge === 'min' ? -1 : 1, y: c.yEdge === 'min' ? -1 : 1 },
                  },
                }
              : { edgeOf: { width: b.width, height: b.height } }),
          },
          paint,
          hitKind: c.kind,
          cursor: resizeCursor(c, xf),
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

/** The resize cursor along the axis a handle drags, as that axis is drawn on
 *  screen: through the target's frame, a turn or a mirror included, and the
 *  view's scale. The glyph is horizontal at angle 0. A corner drags along a
 *  diagonal of its box picked by fixed-corner parity: a matched-axis anchor
 *  (min-min / max-max fixed) drags along local (1, 1), mixed axes along
 *  (1, -1). The keyword is the fallback rather than the answer: CSS has four
 *  of them, which cannot express a target rotated to anything but a multiple
 *  of 45°. */
function resizeCursor(c: ResizeHandleAnchor, xf: TargetTransform): (at: unknown, view: View) => CursorSpec {
  const matched = c.anchor.x === c.anchor.y;
  const [lx, ly, fallback]: [number, number, string] = c.anchor.y === 'free'
    ? [1, 0, 'ew-resize']
    : c.anchor.x === 'free'
      ? [0, 1, 'ns-resize']
      : [1, matched ? 1 : -1, matched ? 'nwse-resize' : 'nesw-resize'];
  const [a, b, cc, d] = xf.toWorld;
  const wx = a * lx + cc * ly;
  const wy = b * lx + d * ly;
  return (_at, view) => ({ glyph: 'resize', angle: Math.atan2(wy * view.scale.y, wx * view.scale.x), fallback });
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
