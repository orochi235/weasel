import type { Affordance, AffordanceBinding, AffordanceRegion, CommonAffordanceScratch } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { FillStyle, Stroke } from 'core/paint-types';
import { MULTI_RESIZE_TARGET_ID } from 'core/selection/selectionTarget';

export interface RotationAffordanceOptions {
  /** Minimum screen-space thickness of the rotate-zone band outside the
   *  selection AABB. The outer ellipse semi-axes are clamped to
   *  `max(w/√2, w/2 + bandPx/scale)` so the zone stays hoverable at any
   *  zoom and any selection size. Default 24. */
  bandPx?: number;
  /** Paint for the ring. `null` / `false` = invisible. Default is a
   *  semi-transparent fill of the band, contracted by `insetPx` screen
   *  pixels on the outer edge so the visible band sits inside the
   *  hoverable zone with a clear margin. Pass a `Stroke` (or
   *  `{ fill, stroke, insetPx }`) to override. */
  paint?:
    | Stroke
    | { fill?: FillStyle; stroke?: Stroke; insetPx?: number }
    | null
    | false;
  /** Cursor while hovering the ring. Defaults to `'grab'`. */
  cursor?: string;
}

export interface RotationScratch extends CommonAffordanceScratch {
  /** Id of the rotation target — single selection id, or
   *  `MULTI_RESIZE_TARGET_ID` for multi-selection. */
  targetId: string;
  /** Rotation pivot in world coords — the AABB (or union AABB) center. */
  fixedPoint: { x: number; y: number };
}

const DEFAULT_PAINT: { fill?: FillStyle; stroke?: Stroke; insetPx?: number } = {
  fill: { fill: 'solid', color: 'rgba(26, 19, 13, 0.12)' },
  insetPx: 10,
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
    paint = DEFAULT_PAINT,
    cursor = 'grab',
  } = opts;

  // Normalize `paint` into the AnnulusPaint shape understood by
  // `composeAffordanceLayer`. Three input forms are accepted: a bare
  // `Stroke` (legacy outline form), the `{ fill, stroke, insetPx }`
  // object form, or `null`/`false` for invisible.
  const annulusPaint:
    | { kind: 'annulus'; fill?: FillStyle; stroke?: Stroke; insetPx?: number }
    | null = (() => {
      if (!paint) return null;
      if ('paint' in paint) {
        // Bare Stroke (has top-level `paint: PaintStyle`).
        return { kind: 'annulus' as const, stroke: paint };
      }
      return {
        kind: 'annulus' as const,
        ...(paint.fill ? { fill: paint.fill } : {}),
        ...(paint.stroke ? { stroke: paint.stroke } : {}),
        ...(paint.insetPx !== undefined ? { insetPx: paint.insetPx } : {}),
      };
    })();

  return {
    id: 'selection.rotation-handle',
    regions(state: ChromeState): readonly AffordanceRegion[] {
      const target = pickTarget(state);
      if (!target) return [];
      const b = target.bounds;

      // The natural ring: the smallest ellipse containing the AABB. For a
      // small or thin selection that band is too tight to hover, so
      // `minBandPx` asks the framework to widen it to at least `bandPx`
      // screen pixels outside the rect. The floor is declared in screen units
      // rather than applied here because `ChromeState` carries no view scale
      // — the framework applies it at paint and hit time, where the view is
      // known, so the ring holds its apparent thickness at any zoom.
      const halfW = b.width / 2;
      const halfH = b.height / 2;

      const region: AffordanceRegion = {
        id: 'selection.rotation-handle',
        targetId: target.id,
        shape: {
          kind: 'annulus',
          cx: b.x + halfW,
          cy: b.y + halfH,
          rx: halfW * Math.SQRT2,
          ry: halfH * Math.SQRT2,
          innerX: b.x,
          innerY: b.y,
          innerWidth: b.width,
          innerHeight: b.height,
          minBandPx: bandPx,
        },
        ...(annulusPaint ? { paint: annulusPaint } : {}),
        hitKind: 'rotate-handle',
        cursor,
        bind: (): AffordanceBinding => ({
          initialScratch: {
            targetId: target.id,
            // Pivot. `rotateAction` recomputes its own union pivot for
            // multi-selection, but the single-target case reads this.
            fixedPoint: { x: b.x + halfW, y: b.y + halfH },
          } satisfies RotationScratch,
        }),
      };
      return [region];
    },
  };
}

function pickTarget(state: ChromeState): { id: string; bounds: Bounds } | null {
  if (state.selection.length === 1) {
    const id = state.selection[0];
    // Skip when the selected node's pose-descriptor declares it can't
    // carry a rotation. Without this the rotation affordance would expose
    // a rotate cursor over (e.g.) polygon-Path selections whose
    // `rotateAction` write is silently dropped at paint time.
    if (state.canRotate && !state.canRotate(id)) return null;
    const b = state.boundsOf(id);
    return b ? { id, bounds: b } : null;
  }
  // Multi-selection: anchor the ring to the union AABB. `rotateAction`
  // ignores the synthetic id and pivots at its own union center
  // (`useUnionPivot: ids.length > 1` branch in `defaults/rotate.ts`).
  // Require every selected id to support rotation — a partial multi-rotate
  // (some ids rotate, others silently no-op) would feel broken.
  if (state.multiActive && state.unionBounds) {
    if (state.canRotate) {
      for (const id of state.selection) {
        if (!state.canRotate(id)) return null;
      }
    }
    return { id: MULTI_RESIZE_TARGET_ID, bounds: state.unionBounds };
  }
  return null;
}
