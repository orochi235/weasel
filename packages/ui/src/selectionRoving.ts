import { selectionKeys, type SelectionModel } from '@weasel-js/ui-input';
import type { UseRovingTabIndexOptions } from './useRovingTabIndex';

/** The `useRovingTabIndex` options for `model`'s keyboard behavior (ui-input's `selectionKeys`). */
export function selectionRoving(
  model: SelectionModel,
  count: number,
  enabled?: (index: number) => boolean,
): Pick<UseRovingTabIndexOptions, 'tabStopIndex' | 'onNavigate' | 'onActivate'> {
  const keys = selectionKeys(model, count, enabled);
  return { tabStopIndex: keys.tabStop, onNavigate: keys.landed, onActivate: keys.activate };
}
