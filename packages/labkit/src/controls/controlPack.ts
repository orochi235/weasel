import type {
  PropertyControlProps,
  PropertyListPack,
  PropertyRowLayout,
} from '@weasel-js/ui/components/Properties';
import type { SectionSpec } from '../config/types';

/** How a panel packs its rows into the two-column property grid, which drops
 *  to one column where the panel is too narrow for two.
 *   - `'auto'`: narrow controls (numbers, checkboxes, dropdowns, colors) sit
 *     two per row; the ones that need the width — text, sliders, segmented
 *     toggles — span it.
 *   - `'pairs'`: two rows to a line. A row a renderer draws, a bar, a group, a
 *     textarea, and a segmented toggle take the whole width.
 *   - `'one-up'`: one control per row, colors excepted.
 */
export type ControlPack = 'auto' | 'pairs' | 'one-up';

/** How the rows under one heading are laid out: the panel's, or a section's own. */
export interface Rows {
  pack: ControlPack;
  layout: PropertyRowLayout | undefined;
  grid: PropertyListPack;
  /** The words of the heading the rows are under, where a section drew one. */
  heading?: string;
}

/** Whether a built-in row takes both columns under `pack`. */
export function spansGrid(field: PropertyControlProps, pack: ControlPack): boolean {
  switch (field.kind) {
    case 'string':
      return field.control === 'textarea' || pack === 'auto';
    case 'number':
      return field.control === 'slider' && pack === 'auto';
    case 'enum':
      return field.control === 'toggle' || field.control === 'radio';
    default:
      return false;
  }
}

export const gridOf = (pack: ControlPack): PropertyListPack =>
  pack === 'one-up' ? 'auto-color' : 'pairs';

export function sectionRows(section: SectionSpec, rows: Rows): Rows {
  return {
    pack: section.pack ?? rows.pack,
    layout: section.layout ?? rows.layout,
    grid: section.pack ? gridOf(section.pack) : rows.grid,
    ...(typeof section.label === 'string' ? { heading: section.label } : {}),
  };
}
