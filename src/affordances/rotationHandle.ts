import type { Affordance, AffordanceBinding, AffordanceRegion } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { Stroke } from 'core/paint-types';
import type { DragChannel } from 'tools/types';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/shared/selectionTarget';

export interface RotationAffordanceOptions {
  /** Minimum screen-space thickness of the rotate-zone band outside the
   *  selection AABB. The outer ellipse semi-axes are clamped to
   *  `max(w/√2, w/2 + bandPx/scale)` so the zone stays hoverable at any
   *  zoom and any selection size. Default 24. */
  bandPx?: number;
  /** Dev-time paint for the ring. `null` / `undefined` = invisible (the
   *  shipping default, once we cut over to debug-only visibility). Pass
   *  a `Stroke` to draw the outer ellipse as a hint — useful while
   *  building or for explicit affordance discovery. */
  paint?: Stroke | null | false;
  /** Cursor while hovering the ring. Defaults to `'grab'`. */
  cursor?: string;
}

export interface RotationScratch {
  /** Id of the rotation target — single selection id, or
   *  `MULTI_RESIZE_TARGET_ID` for multi-selection. */
  targetId: string;
}

const stubDrag: DragChannel<RotationScratch> = {
  onStart: () => 'claim',
  onMove: () => 'claim',
  onEnd: () => 'claim',
  onCancel: () => {},
};

const DEFAULT_DEV_STROKE: Stroke = {
  paint: { color: 'rgba(26, 19, 13, 0.25)' },
  width: 1,
  dash: [3, 3],
};

/**
 * @experimental
 * Rotation affordance for the active selection. Replaces the legacy
 * "small dot above the AABB" handle with an invisible elliptical ring
 * that wraps the selection: the smallest ellipse containing the AABB,
 * minus the AABB itself. Hovering the ring sets the cursor (default
 * `'grab'`) and drag-from-ring triggers `rotateAction` via the same
 * binding path the old point-handle used (id stays
 * `'selection.rotation-handle'`).
 *
 * The ring is target-local — under target rotation the ellipse rotates
 * with the AABB so the hoverable band always wraps the rendered shape.
 *
 * Visibility: gated by chrome-caps' `'selection.rotation-handle'` rule.
 * The `paint` option drives optional dev-time ring stroke; production
 * defaults to invisible (the cursor change is the only on-hover cue).
 */
export function createRotationAffordance(
  opts: RotationAffordanceOptions = {},
): Affordance {
  const {
    bandPx = 24,
    paint = DEFAULT_DEV_STROKE,
    cursor = 'grab',
  } = opts;

  return {
    id: 'selection.rotation-handle',
    regions(state: ChromeState): readonly AffordanceRegion[] {
      const target = pickTarget(state);
      if (!target) return [];
      const b = target.bounds;

      // Convert bandPx to world coords. ChromeState doesn't carry view
      // scale — use a sentinel value that the kit's paint pipeline will
      // narrow at draw time. For now: use a fixed world-space band that
      // approximates 24px at scale=1. The kit's `meanScale(view.scale)`
      // can't reach the affordance from here (composeAffordanceLayer
      // doesn't pass it down). Acceptable: the natural corner-passing
      // ellipse (`w/√2`, `h/√2`) already gives a hoverable band for any
      // selection wider than ~2× bandPx, and the clamp below covers
      // thin selections. Zoom adjustment is a follow-up if it matters.
      const minBand = bandPx;
      const halfW = b.width / 2;
      const halfH = b.height / 2;
      const naturalRx = halfW * Math.SQRT2;
      const naturalRy = halfH * Math.SQRT2;
      const rx = Math.max(naturalRx, halfW + minBand);
      const ry = Math.max(naturalRy, halfH + minBand);

      const region: AffordanceRegion = {
        id: 'selection.rotation-handle',
        targetId: target.id,
        shape: {
          kind: 'annulus',
          cx: b.x + halfW,
          cy: b.y + halfH,
          rx,
          ry,
          innerX: b.x,
          innerY: b.y,
          innerWidth: b.width,
          innerHeight: b.height,
        },
        ...(paint
          ? { paint: { kind: 'annulus' as const, stroke: paint } }
          : {}),
        cursor,
        bind: (): AffordanceBinding => ({
          drag: stubDrag as unknown as AffordanceBinding['drag'],
          initialScratch: { targetId: target.id } satisfies RotationScratch,
        }),
      };
      return [region];
    },
  };
}

function pickTarget(state: ChromeState): { id: string; bounds: Bounds } | null {
  if (state.selection.length === 1) {
    const id = state.selection[0];
    const b = state.boundsOf(id);
    return b ? { id, bounds: b } : null;
  }
  // Multi-selection: anchor the ring to the union AABB. `rotateAction`
  // ignores the synthetic id and pivots at its own union center
  // (`useUnionPivot: ids.length > 1` branch in `defaults/rotate.ts`).
  if (state.multiActive && state.unionBounds) {
    return { id: MULTI_RESIZE_TARGET_ID, bounds: state.unionBounds };
  }
  return null;
}
