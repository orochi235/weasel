import { useContext, useLayoutEffect, type Context, type RefCallback, type RefObject } from 'react';
import type { Key } from 'react-aria-components';

/**
 * React Aria props that keep a disabled list row in reach of the arrow keys but out of selection, as the ARIA guide
 * has a listbox do: the item's own `disabledBehavior`, which React Aria reads off an item though its types leave it
 * out. React Aria then marks the row neither `aria-disabled` nor `data-disabled`; {@link heldAriaRef} marks it.
 */
export function heldItemProps(disabled: boolean | undefined): { isDisabled?: boolean } {
  return disabled ? ({ isDisabled: true, disabledBehavior: 'selection' } as { isDisabled?: boolean }) : {};
}

/** A ref that marks its element `aria-disabled` while `held`, with `reason` as its `aria-description`: React Aria
 *  writes neither on a row or tab it lets focus land on, and passes neither through as a prop. A callback, since
 *  React Aria renders a collection's element after the item component that declared it. */
export function heldAriaRef(held: boolean | undefined, reason?: string): RefCallback<HTMLElement> | undefined {
  if (!held) return undefined;
  return (el) => {
    if (!el) return;
    el.setAttribute('aria-disabled', 'true');
    if (reason) el.setAttribute('aria-description', reason);
    return () => {
      el.removeAttribute('aria-disabled');
      el.removeAttribute('aria-description');
    };
  };
}

/** The items of a React Aria collection, enough of it to walk. */
interface Walkable {
  getItem(key: Key): { type: string; props?: { isDisabled?: boolean; 'aria-disabled'?: boolean } } | null | undefined;
  getKeyAfter(key: Key): Key | null;
  getKeyBefore(key: Key): Key | null;
  getKeys(): Iterable<Key>;
}

/** Whether the row at `key` is held disabled: a list row by {@link heldItemProps}, a tab by an `aria-disabled` prop,
 *  which React Aria keeps on the item and leaves off the DOM. */
export function isHeldKey(collection: Walkable, key: Key): boolean {
  const props = collection.getItem(key)?.props;
  return props?.isDisabled === true || props?.['aria-disabled'] === true;
}

/** The first row from `key` on, `dir` 1 forward and -1 back, that is not held disabled, or null. */
export function freeKeyFrom(collection: Walkable, key: Key | null, dir: 1 | -1): Key | null {
  for (let at = key; at !== null; at = dir === 1 ? collection.getKeyAfter(at) : collection.getKeyBefore(at)) {
    const item = collection.getItem(at);
    if (item?.type === 'item' && !isHeldKey(collection, at)) return at;
  }
  return null;
}

/** Where a change of value from `from` to the held row `to` lands instead: on the first free row past `to` the way it
 *  was going, as a closed select's arrow keys pass over a held row, or null for none. */
export function pastHeld(collection: Walkable, from: Key | null, to: Key): Key | null {
  const keys = [...collection.getKeys()];
  const dir = from === null || keys.indexOf(to) > keys.indexOf(from) ? 1 : -1;
  return freeKeyFrom(collection, to, dir);
}

/** Keeps `into` on the React Aria state `context` provides where this renders, for a handler above it to read. */
export function StateProbe<S>({ context, into }: { context: Context<S | null>; into: RefObject<S | null> }): null {
  const state = useContext(context);
  useLayoutEffect(() => {
    into.current = state;
  });
  return null;
}
