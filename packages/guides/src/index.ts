/**
 * @weasel-js/guides — placement aids for weasel: a visible grid, ruler guides,
 * the snap sources that snap to them and to sibling edges and gaps, and the
 * layout strategies a container arranges its children with.
 */

// ─── Grid: the visible lattice and its hover cell ───────────────────────────
export * from './grid';

// ─── Guides: guide lines, and the alignment and spacing math ────────────────
export * from './guides';

// ─── Snap sources: grid, ruler guides, alignment, equal spacing ─────────────
export * from './sources';

// ─── Spacing hints: equal-spacing snaps on move, and Alt-hover distances ────
export * from './spacingHints';

// ─── Layout strategies, and the drop-target pickers they are built from ─────
export * from './layout/snaps';
export * from './layout/perContainer';
export * from './layout/strategies';
export type { SnapPattern } from './layout/strategies/snapPoint';
