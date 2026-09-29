import {
  AUTO_ORIGIN_PROJECTION,
  fromPlane,
  resolveUnit,
  toPlane,
  type DebugSink,
  type OriginProjection,
  type SnapStrategy,
  type UnitSystem,
  type UnitValue,
} from '@weasel-js/core';

/** Snap-strategy that rounds the pose's origin to the nearest multiple of
 *  `spacing` (resolved through `unitSystem`). For non-rect TPose pass an
 *  `OriginProjection` so the strategy knows how to read/write the origin. */
export function gridSnapStrategy<TPose>(
  spacing: UnitValue,
  unitSystem?: UnitSystem,
): SnapStrategy<TPose>;
/** As above, additionally reporting each candidate to a debug sink. */
export function gridSnapStrategy<TPose>(
  spacing: UnitValue,
  opts: { unitSystem?: UnitSystem; debug?: DebugSink },
): SnapStrategy<TPose>;
/** As above, for a `TPose` that is not a rect: `origin` tells the strategy how
 *  to read and write the pose's origin. */
export function gridSnapStrategy<TPose>(
  spacing: UnitValue,
  opts: { unitSystem?: UnitSystem; origin: OriginProjection<TPose>; debug?: DebugSink },
): SnapStrategy<TPose>;
/** Snap-strategy that rounds the pose's origin to the nearest multiple of
 *  `spacing` (resolved through `unitSystem`). For non-rect TPose pass an
 *  `OriginProjection` so the strategy knows how to read/write the origin. */
export function gridSnapStrategy<TPose>(
  spacing: UnitValue,
  arg?: UnitSystem | { unitSystem?: UnitSystem; origin?: OriginProjection<TPose>; debug?: DebugSink },
): SnapStrategy<TPose> {
  const isOpts =
    typeof arg === 'object' &&
    arg !== null &&
    ('origin' in arg || 'debug' in arg || 'unitSystem' in arg) &&
    !('base' in arg);
  const optsArg = isOpts
    ? (arg as { unitSystem?: UnitSystem; origin?: OriginProjection<TPose>; debug?: DebugSink })
    : null;
  const unitSystem = optsArg ? optsArg.unitSystem : (arg as UnitSystem | undefined);
  const proj: OriginProjection<TPose> = optsArg && optsArg.origin
    ? optsArg.origin
    : (AUTO_ORIGIN_PROJECTION as unknown as OriginProjection<TPose>);
  const debug: DebugSink | undefined = optsArg ? optsArg.debug : undefined;
  const c = resolveUnit(spacing, unitSystem);
  return {
    snap(pose, ctx) {
      const o = proj.getOrigin(pose);
      // The grid is the camera's: on a plane, round where the origin lies in
      // the camera's world and carry the lattice point back.
      const m = ctx?.plane ?? null;
      const w = m ? fromPlane(m, o) : o;
      const cell = { x: Math.round(w.x / c) * c, y: Math.round(w.y / c) * c };
      const { x: sx, y: sy } = m ? toPlane(m, cell) : cell;
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
  spacing: UnitValue,
  unitSystem?: UnitSystem,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): { col: number; row: number } {
  const s = resolveUnit(spacing, unitSystem);
  return {
    col: Math.floor((point.x - origin.x) / s),
    row: Math.floor((point.y - origin.y) / s),
  };
}
