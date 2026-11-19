import { createElement, useCallback, useContext, useLayoutEffect, useRef, type Context, type ReactElement, type RefCallback, type RefObject } from 'react';
import type { Key } from 'react-aria-components';

/**
 * React Aria props that keep a disabled list row in reach of the arrow keys but out of selection, as the ARIA guide
 * has a listbox do: the item's own `disabledBehavior`, which React Aria reads off an item though its types leave it
 * out. React Aria then marks the row neither `aria-disabled` nor `data-disabled`; {@link useHeldAriaRef} marks it.
 */
export function heldItemProps(disabled: boolean | undefined): { isDisabled?: boolean } {
  return disabled ? ({ isDisabled: true, disabledBehavior: 'selection' } as { isDisabled?: boolean }) : {};
}

/** A ref that marks its element `aria-disabled` and `data-disabled`, the kit's styling hook, while `held`, with
 *  `reason` as its `aria-description`, and keeps it on `intoRef`: React Aria writes none of them on a row or tab it
 *  lets focus land on, and passes none through as a prop.
 *  A callback, since React Aria renders a collection's element after the item component that declared it, and the
 *  same one while `held` and `reason` stay, since React Aria rebuilds its press handling on a new ref. */
export function useHeldAriaRef(
  held: boolean | undefined, reason?: string, intoRef?: RefObject<HTMLElement | null>,
): RefCallback<HTMLElement> {
  return useCallback((el: HTMLElement | null) => {
    if (intoRef) intoRef.current = el;
    if (!el || !held) return;
    el.setAttribute('aria-disabled', 'true');
    const ownMark = !el.hasAttribute('data-disabled');
    el.setAttribute('data-disabled', '');
    if (reason) el.setAttribute('aria-description', reason);
    // A ref returning a cleanup is never called with null, so the cleanup lets go of `el` itself.
    return () => {
      if (intoRef?.current === el) intoRef.current = null;
      el.removeAttribute('aria-disabled');
      if (ownMark) el.removeAttribute('data-disabled');
      el.removeAttribute('aria-description');
    };
  }, [held, reason, intoRef]);
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

/** Keeps `intoRef` on the React Aria state `context` provides where this renders, for a handler above it to read. */
export function StateProbe<S>({ context, intoRef }: { context: Context<S | null>; intoRef: RefObject<S | null> }): null {
  const state = useContext(context);
  // React Aria renders a collection's children twice, once with no state to build it; that copy leaves the ref be.
  useLayoutEffect(() => {
    if (state) intoRef.current = state;
  });
  return null;
}

/** A probe to render under a React Aria select-like `context`, and what a pick of `picked` from `from` comes to there:
 *  itself; when it is held, the first free row past it the way it was going if the pick was an arrow `step`
 *  ({@link pastHeld}); or `undefined` for none, as for a held row typeahead lands on. */
export function useHeldPick<S extends { collection: Walkable }>(context: Context<S | null>): {
  probe: ReactElement;
  pick(from: Key | null, picked: Key | null, step: boolean): Key | null | undefined;
} {
  const stateRef = useRef<S | null>(null);
  return {
    probe: createElement(StateProbe<S>, { context, intoRef: stateRef }),
    pick(from, picked, step) {
      const coll = stateRef.current?.collection;
      if (picked === null || !coll || !isHeldKey(coll, picked)) return picked;
      return step ? (pastHeld(coll, from, picked) ?? undefined) : undefined;
    },
  };
}
