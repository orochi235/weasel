import type { Affordance, AffordanceBinding, AffordanceRegion, CommonAffordanceScratch } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { CommandStroke, CommandFill } from '@weasel-js/paint';
import { MULTI_RESIZE_TARGET_ID } from 'core/selection/selectionTarget';
import { localToWorld, transformOf } from './hitAffordanceRegions';
import type { CursorSpec } from '@weasel-js/cursor';
import { rotateCursorAt } from './rotateCursor';

/** Options for `createRotationAffordance` — how thick the rotate band is
 *  outside the selection, and how (or whether) it is painted. */
export interface RotationAffordanceOptions {
  /** Minimum screen-space thickness of the rotate-zone band outside the selection AABB, so
   *  the zone stays hoverable at any zoom and any selection size. Default 24. */
  bandPx?: number;
  /** Paint for the ring. `null` / `false` = invisible. Default is a semi-transparent fill of
   *  the band, contracted by `insetPx` screen pixels on the outer edge. Pass a `Stroke` (or
   *  `{ fill, stroke, insetPx }`) to override. */
  paint?:
    | CommandStroke
    | { fill?: CommandFill; stroke?: CommandStroke; insetPx?: number }
    | null
    | false;
  /** Cursor while hovering the ring. Defaults to the `rotate` glyph turned
   *  square to the line from the pivot to the pointer, falling back to
   *  `'grab'` if the browser rejects the image. */
  cursor?: CursorSpec;
  /** A grab region for a rotate badge painted off the top edge — the one
   *  the selection overlay's `rotationHandle` draws. `distancePx` is how far
   *  off the edge it sits and `hitRadiusPx` the half-extent of its square,
   *  both in screen pixels. Placed by the same `standoff` the painted badge
   *  is, so the two cannot drift apart. Omitted, only the ring rotates. */
  handle?: { distancePx: number; hitRadiusPx: number };
}

/** What a rotation-handle hit hands to the rotate action: what is being
 *  rotated, and the world-space pivot it turns around. */
export interface RotationScratch extends CommonAffordanceScratch {
  /** Id of the rotation target — single selection id, or
   *  `MULTI_RESIZE_TARGET_ID` for multi-selection. */
  targetId: string;
  /** Rotation pivot in world coords — the AABB (or union AABB) center. */
  fixedPoint: { x: number; y: number };
}

type AnnulusPaintForm = { fill?: CommandFill; stroke?: CommandStroke; insetPx?: number };

const isAnnulusForm = (paint: CommandStroke | AnnulusPaintForm): paint is AnnulusPaintForm =>
  'fill' in paint || 'stroke' in paint || 'insetPx' in paint;

const DEFAULT_PAINT: AnnulusPaintForm = {
  fill: { paint: { kind: 'solid', color: 'rgba(26, 19, 13, 0.12)' } },
  insetPx: 10,
};

/**
 * @experimental
 * Rotation affordance for the active selection: an elliptical ring that wraps the selection —
 * the smallest ellipse containing the AABB, minus the AABB itself. Hovering the ring sets the
 * cursor (default the `rotate` glyph) and a drag from it triggers `rotateAction`.
 *
 * The ring is target-local — under target rotation the ellipse rotates with the AABB.
 * Visibility is gated by chrome-caps' `'selection.rotation-handle'` rule. `paint: null` leaves
 * the cursor change as the only cue.
 */
export function createRotationAffordance(
  opts: RotationAffordanceOptions = {},
): Affordance {
  const { bandPx = 24, paint = DEFAULT_PAINT, cursor, handle } = opts;

  // A bare `Stroke` carries none of the object form's three keys, and cannot be told apart
  // by its own `paint` since that is optional.
  const annulusPaint:
    | { kind: 'annulus'; fill?: CommandFill; stroke?: CommandStroke; insetPx?: number }
    | null = (() => {
      if (!paint) return null;
      if (!isAnnulusForm(paint)) {
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

      // The natural ring is the smallest ellipse containing the AABB. `minBandPx` asks the
      // framework to widen it to at least `bandPx` screen pixels outside the rect; the floor is
      // declared in screen units because `ChromeState` carries no view scale.
      const halfW = b.width / 2;
      const halfH = b.height / 2;

      const pivot = localToWorld(transformOf(state, target.id), b.x + halfW, b.y + halfH);
      const regionCursor: AffordanceRegion['cursor'] = cursor
        ?? ((at, view) => rotateCursorAt(pivot, at, view.scale));
      const bind = (): AffordanceBinding => ({
        initialScratch: {
          targetId: target.id,
          // Pivot. `rotateAction` recomputes its own union pivot for
          // multi-selection, but the single-target case reads this.
          fixedPoint: { x: b.x + halfW, y: b.y + halfH },
        } satisfies RotationScratch,
      });

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
        cursor: regionCursor,
        bind,
      };
      if (!handle) return [region];
      const badge: AffordanceRegion = {
        id: 'rotation-badge',
        targetId: target.id,
        shape: {
          kind: 'point',
          x: b.x + halfW,
          y: b.y,
          hitRadiusPx: handle.hitRadiusPx,
          standoff: { px: handle.distancePx, normal: { x: 0, y: -1 } },
        },
        hitKind: 'rotate-handle',
        cursor: regionCursor,
        bind,
      };
      return [region, badge];
    },
  };
}

function pickTarget(state: ChromeState): { id: string; bounds: Bounds } | null {
  if (state.selection.length === 1) {
    const id = state.selection[0];
    // Skip when the selected node's pose-descriptor declares it can't carry a rotation;
    // otherwise the ring would offer a rotate cursor over a node whose write is dropped.
    if (state.canRotate && !state.canRotate(id)) return null;
    const b = state.boundsOf(id);
    return b ? { id, bounds: b } : null;
  }
  // Multi-selection: anchor the ring to the union AABB; `rotateAction` ignores the synthetic
  // id and pivots at its own union center. Every selected id must support rotation — a
  // partial multi-rotate would feel broken.
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
