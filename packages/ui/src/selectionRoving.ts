import { selectionKeys, type SelectionModel } from '@weasel-js/ui-input';
import type { UseRovingTabIndexOptions } from './useRovingTabIndex';

/** The `useRovingTabIndex` options for `model`'s keyboard behavior (ui-input's `selectionKeys`). */
export function selectionRoving(
  model: SelectionModel,
  count: number,
  enabled?: (index: number) => boolean,
): Pick<UseRovingTabIndexOptions, 'tabStopIndex' | 'onNavigate' | 'onAction'> {
  const keys = selectionKeys(model, count, enabled);
  const { activate } = keys;
  return {
    tabStopIndex: keys.tabStop,
    onNavigate: keys.landed,
    onAction: activate && ((index, event) => activate(index, { alt: event.altKey })),
  };
}
