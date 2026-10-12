import {
  AUTO_ORIGIN_PROJECTION,
  resolveAxes,
  type DebugSink,
  type OriginProjection,
  type SnapStrategy,
  type PlaneUnits,
  type PlaneValue,
} from '@weasel-js/core';
import { roundToGridOn } from './onPlane';

/** Snap-strategy that rounds the pose's origin to the nearest multiple of
 *  `spacing` (resolved through `unitSystem`). Either may be per axis —
 *  `{ x, y }` — for a grid whose axes have different pitches or units. For
 *  non-rect TPose pass an `OriginProjection` so the strategy knows how to
 *  read/write the origin. */
export function gridSnapStrategy<TPose>(
  spacing: PlaneValue,
  unitSystem?: PlaneUnits,
): SnapStrategy<TPose>;
/** As above, additionally reporting each candidate to a debug sink. */
export function gridSnapStrategy<TPose>(
  spacing: PlaneValue,
  opts: { unitSystem?: PlaneUnits; debug?: DebugSink },
): SnapStrategy<TPose>;
/** As above, for a `TPose` that is not a rect: `origin` tells the strategy how
 *  to read and write the pose's origin. */
export function gridSnapStrategy<TPose>(
  spacing: PlaneValue,
  opts: { unitSystem?: PlaneUnits; origin: OriginProjection<TPose>; debug?: DebugSink },
): SnapStrategy<TPose>;
/** Snap-strategy that rounds the pose's origin to the nearest multiple of
 *  `spacing` (resolved through `unitSystem`). For non-rect TPose pass an
 *  `OriginProjection` so the strategy knows how to read/write the origin. */
export function gridSnapStrategy<TPose>(
  spacing: PlaneValue,
  arg?: PlaneUnits | { unitSystem?: PlaneUnits; origin?: OriginProjection<TPose>; debug?: DebugSink },
): SnapStrategy<TPose> {
  const isOpts =
    typeof arg === 'object' &&
    arg !== null &&
    ('origin' in arg || 'debug' in arg || 'unitSystem' in arg) &&
    !('base' in arg) &&
    !('x' in arg);
  const optsArg = isOpts
    ? (arg as { unitSystem?: PlaneUnits; origin?: OriginProjection<TPose>; debug?: DebugSink })
    : null;
  const unitSystem = optsArg ? optsArg.unitSystem : (arg as PlaneUnits | undefined);
  const proj: OriginProjection<TPose> = optsArg && optsArg.origin
    ? optsArg.origin
    : (AUTO_ORIGIN_PROJECTION as unknown as OriginProjection<TPose>);
  const debug: DebugSink | undefined = optsArg ? optsArg.debug : undefined;
  const c = resolveAxes(spacing, unitSystem);
  return {
    snap(pose, ctx) {
      const o = proj.getOrigin(pose);
      const sx = roundToGridOn(o.x, 'x', c.x, ctx?.plane);
      const sy = roundToGridOn(o.y, 'y', c.y, ctx?.plane);
      debug?.recordSnapCandidate({ x: sx, y: sy }, true);
      return proj.translate(pose, sx - o.x, sy - o.y);
    },
  };
}

/**
 * Compute the integer cell `{col, row}` that contains `point`, given a grid
 * `spacing` and optional `origin` and `unitSystem`. Pair with
 * `createCellHighlightLayer` (its `getCell` callback) to draw a snap-target
 * preview that uses the same spacing as `gridSnapStrategy` — so the visual
 * and behavioral grids stay in lockstep:
 *
 *     const SPACING = 20;
 *     const snap = gridSnapStrategy(SPACING);
 *     // visual grid:
 *     createGridLayer({ spacing: SPACING, bounds: () => ... });
 *     // hover-preview overlay:
 *     createCellHighlightLayer({
 *       spacing: SPACING,
 *       getCell: () => hoverPoint && pointToGridCell(hoverPoint, SPACING),
 *     });
 */
export function pointToGridCell(
  point: { x: number; y: number },
  spacing: PlaneValue,
  unitSystem?: PlaneUnits,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): { col: number; row: number } {
  const s = resolveAxes(spacing, unitSystem);
  return {
    col: Math.floor((point.x - origin.x) / s.x),
    row: Math.floor((point.y - origin.y) / s.y),
  };
}
