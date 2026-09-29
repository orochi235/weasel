/**
 * @weasel-js/guides — placement aids for weasel: a visible grid and snapping
 * to it, guide lines and alignment to sibling edges, and the layout strategies
 * a container arranges its children with.
 *
 * Everything here is built on seams in `@weasel-js/core`: a snap strategy is
 * a `SnapStrategy` (wrap it with core's `snap` to get a `MoveBehavior`), the
 * resize and insert behaviors are `BoundsConstraint`s, `InsertBehavior`s and
 * `PointSnapBehavior`s, the layers are `RenderLayer`s for a canvas slot, and
 * a layout strategy implements core's `LayoutStrategy`.
 *
 * `snapToGrid` and `snapToGuides` exist for move, resize and insert with
 * different shapes, so they are imported from a per-action subpath:
 *   import { snapToGrid } from '@weasel-js/guides/move';
 *   import { snapToGrid, pointSnapToGrid } from '@weasel-js/guides/resize';
 *   import { snapToGrid } from '@weasel-js/guides/insert';
 */

// ─── Grid: the visible lattice, its hover cell, and snapping to it ──────────
export * from './grid';
export { gridSnapStrategy, pointToGridCell } from './strategies/grid';
export { pointSnapToGrid } from './behaviors/resize/pointSnapToGrid';

// ─── Guides: guide lines, snapping to them, and alignment to siblings ───────
export * from './guides';
export { guideSnapStrategy, DEFAULT_GUIDE_TOLERANCE_PX } from './strategies/guides';
export type { GuideSnapOptions } from './strategies/guides';

// ─── Layout strategies, and the drop-target pickers they are built from ─────
export * from './layout/snaps';
export * from './layout/strategies';
export type { SnapPattern } from './layout/strategies/snapPoint';
