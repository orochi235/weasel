import { soloChanges } from '@weasel-js/ui-input';
import type { LayerListItem } from './layerListProps';

/** A column of per-row toggles in a `LayerList`. */
export type ToggleColumn = 'visible' | 'locked';

const isOn = (item: LayerListItem, column: ToggleColumn): boolean =>
  column === 'visible' ? item.visible !== false : item.locked === true;

const hasToggle = (item: LayerListItem, column: ToggleColumn): boolean =>
  !item.fixed && (column === 'locked' || item.hideable !== false);

/**
 * What an Alt-click on `id`'s toggle in `column` changes: that layer alone on, every other layer off, or every
 * layer back on when it already was alone. Layers inside the one clicked keep their own state. Shown alone, a
 * layer's containers are shown with it, since a hidden container hides what it holds.
 */
export function soloLayer(items: readonly LayerListItem[], id: string, column: ToggleColumn): Record<string, boolean> {
  const states = new Map<string, boolean>();
  const keep = new Set<string>([id]);
  const walk = (list: readonly LayerListItem[], path: readonly string[]): void => {
    for (const item of list) {
      if (hasToggle(item, column)) states.set(item.id, isOn(item, column));
      if (item.id === id) {
        if (column === 'visible') for (const up of path) keep.add(up);
      } else if (item.children) {
        walk(item.children, [...path, item.id]);
      }
    }
  };
  walk(items, []);
  return soloChanges(states, keep);
}
