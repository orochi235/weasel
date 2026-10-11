import type { PropertyListPack, PropertyRowLayout } from '@weasel-js/ui';
import type { SectionSpec } from '../config/types';

/** How a panel packs its rows into the two-column property grid.
 *   - `'auto'`: narrow controls (numbers, checkboxes, dropdowns, colors) sit
 *     two per row; the ones that need the width — text, sliders, segmented
 *     toggles — span it.
 *   - `'pairs'`: every row pairs. A control that needs the full width says so
 *     itself, with `<PropertyRow span>`.
 *   - `'one-up'`: one control per row, colors excepted.
 */
export type ControlPack = 'auto' | 'pairs' | 'one-up';

/** How the rows under one heading are laid out: the panel's, or a section's own. */
export interface Rows {
  pack: ControlPack;
  layout: PropertyRowLayout | undefined;
  grid: PropertyListPack;
}

export const gridOf = (pack: ControlPack): PropertyListPack =>
  pack === 'one-up' ? 'auto-color' : 'pairs';

export function sectionRows(section: SectionSpec, rows: Rows): Rows {
  return {
    pack: section.pack ?? rows.pack,
    layout: section.layout ?? rows.layout,
    grid: section.pack ? gridOf(section.pack) : rows.grid,
  };
}
