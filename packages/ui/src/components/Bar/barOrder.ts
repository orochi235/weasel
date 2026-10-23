import { createContext, useContext } from 'react';
import { isPrefLeaf, type PrefGroup, type PrefLeaf, type PrefOrder } from '@weasel-js/prefs';

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

/** `order` with `container`'s list set to `keys`, the entry at index `from` moved to index `to`; `order` itself where
 *  either index is not one of `keys`'. */
export function movedOrder(order: PrefOrder, container: string, keys: readonly string[], from: number, to: number): PrefOrder {
  const within = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < keys.length;
  if (!within(from) || !within(to)) return order;
  const next = [...keys];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return { ...order, [container]: next };
}

/** The child keys of the group at `container` in `group`, in its order; undefined where no group sits there. */
export function childKeysAt(group: PrefGroup, container: string): string[] | undefined {
  let at: PrefGroup | PrefLeaf | undefined = group;
  for (const key of container === '' ? [] : container.split('.')) at = at === undefined || isPrefLeaf(at) ? undefined : at.children[key];
  return at === undefined || isPrefLeaf(at) ? undefined : Object.keys(at.children);
}
