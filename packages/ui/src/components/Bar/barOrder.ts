import { createContext, useContext } from 'react';
import type { PrefOrder } from '@weasel-js/prefs';

/** Marks a bar's DOM unit a reorder can move, with the unit's key inside its container. */
export const BAR_UNIT = 'data-bar-unit';

/** The container path of the unit it sits on: `''` at the bar's top level, else a group's or an `actions` leaf's path. */
export const BAR_IN = 'data-bar-in';

/** True where the bar marks the units a reorder moves: set by `BarLayout`, and off inside what opens from a button. */
export const BarMarkContext = createContext(false);

/** Whether the buttons of an `actions` run carry unit marks here. */
export const useBarMarks = (): boolean => useContext(BarMarkContext);

/** The last segment of `path`: a unit's key inside its container. */
export const barUnitKey = (path: string): string => path.slice(path.lastIndexOf('.') + 1);

/** `order` with `container`'s list set to `keys`, the entry at index `from` moved to index `to`. */
export function movedOrder(order: PrefOrder, container: string, keys: readonly string[], from: number, to: number): PrefOrder {
  const next = [...keys];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return { ...order, [container]: next };
}
