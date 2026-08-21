import type { SnapStrategy } from '../../types';
import { resolveUnit, type UnitSystem, type UnitValue } from 'core/units';
import type { DebugSink } from '../../../../debug/types';
import { isPathLike } from 'interactions/actions/resize/autoPoseDescriptor';
import { boundsOfPath } from 'features/paths/bounds';
import { translatePath } from 'features/paths/transform';
import type { Path } from 'features/paths/types';

/**
 * Projection used by `gridSnapStrategy` when `TPose` doesn't expose `{x,y}`
 * directly (Path, polygon, etc.). The strategy reads the snap point via
 * `getOrigin`, rounds it to the grid, then asks `translate` to move the
 * pose by the resulting delta.
 */
export interface OriginProjection<TPose> {
  getOrigin(pose: TPose): { x: number; y: number };
  translate(pose: TPose, dx: number, dy: number): TPose;
}

/** Identity projection for `TPose extends { x; y }`. */
export const RECT_ORIGIN_PROJECTION: OriginProjection<{ x: number; y: number }> = {
  getOrigin: (p) => ({ x: p.x, y: p.y }),
  translate: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
};

/** Per-call dispatch: routes Path-shaped poses to the path origin/translate
 *  helpers and everything else to `RECT_ORIGIN_PROJECTION`. Default for
 *  `gridSnapStrategy` so consumers with Path TPose don't have to thread
 *  `pathOriginProjection` explicitly. */
export const AUTO_ORIGIN_PROJECTION: OriginProjection<unknown> = {
  getOrigin: (p) => {
    if (isPathLike(p)) {
      const b = boundsOfPath(p as Path);
      return { x: b.x, y: b.y };
    }
    const r = p as { x: number; y: number };
    return { x: r.x, y: r.y };
  },
  translate: (p, dx, dy) => {
    if (isPathLike(p)) return translatePath(p as Path, dx, dy);
    const r = p as { x: number; y: number };
    return { ...r, x: r.x + dx, y: r.y + dy };
  },
};

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
    snap(pose) {
      const o = proj.getOrigin(pose);
      const sx = Math.round(o.x / c) * c;
      const sy = Math.round(o.y / c) * c;
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
