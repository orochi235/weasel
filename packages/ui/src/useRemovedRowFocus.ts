import { useLayoutEffect, useRef } from 'react';

/** A row as the keeper sees it: its id, and in a tree the id of the row it sits under. */
export interface FocusRow {
  id: string;
  parentId?: string | null;
}

/**
 * The row that takes over from `id` once it is gone from `rows`, the order it was last drawn in: the next sibling
 * still `alive`, else the nearest row above it, else the nearest below.
 */
export function heirOf(rows: readonly FocusRow[], id: string, alive: (id: string) => boolean): string | null {
  const at = rows.findIndex((r) => r.id === id);
  if (at < 0) return null;
  const parent = rows[at]!.parentId ?? null;
  const after = rows.slice(at + 1);
  const above = rows.slice(0, at).reverse();
  const heir =
    after.find((r) => (r.parentId ?? null) === parent && alive(r.id)) ??
    above.find((r) => alive(r.id)) ??
    after.find((r) => alive(r.id));
  return heir?.id ?? null;
}

/**
 * Keeps focus in a list when the row holding it is removed: a consumer's own delete control, or a branch folded
 * away under the focused row. A focused row drawn again on a new element, as a move into another branch remounts it,
 * gets focus back there. Removing the focused element drops focus to the page, and the next arrow key goes
 * nowhere.
 *
 * `rows` is every row in drawn order. Put `rowRef(id)` on each row's element; `focus(id)` moves focus to the row
 * that takes over. Returns the map of row elements beside it.
 */
export function useRemovedRowFocus<E extends HTMLElement>(
  rows: readonly FocusRow[],
  focus: (id: string, els: ReadonlyMap<string, E>) => void,
): { els: { readonly current: Map<string, E> }; rowRef(id: string): (el: E | null) => void } {
  const els = useRef(new Map<string, E>());
  /** Rows that held focus when their ref let go this commit, and the element they let go of. A row still drawn takes
   *  its ref straight back, on that element or, remounted under a new parent, on a new one. */
  const held = useRef(new Map<string, E>());
  const drawn = useRef(rows);

  // React lets go of a ref before it takes the element out of the page, so focus can still be read here.
  const rowRef = (id: string) => (el: E | null) => {
    if (el) {
      els.current.set(id, el);
      return;
    }
    const was = els.current.get(id);
    if (was?.contains(was.ownerDocument.activeElement)) held.current.set(id, was);
    els.current.delete(id);
  };

  useLayoutEffect(() => {
    const before = drawn.current;
    drawn.current = rows;
    const lost = [...held.current];
    held.current.clear();
    if (lost.length === 0) return;
    // Something else took focus in the same commit: leave it there.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const moved = lost.find(([id, was]) => els.current.has(id) && els.current.get(id) !== was);
    if (moved) {
      focus(moved[0], els.current);
      return;
    }
    const gone = before.find((r) => !els.current.has(r.id) && lost.some(([id]) => id === r.id));
    if (!gone) return;
    const heir = heirOf(before, gone.id, (id) => els.current.has(id));
    if (heir != null) focus(heir, els.current);
  });

  return { els, rowRef };
}
