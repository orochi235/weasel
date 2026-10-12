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
 * away under the focused row. Removing the focused element drops focus to the page, and the next arrow key goes
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
  /** Rows that held focus when their ref let go this commit. A row still drawn takes its ref straight back. */
  const held = useRef(new Set<string>());
  const drawn = useRef(rows);

  // React lets go of a ref before it takes the element out of the page, so focus can still be read here.
  const rowRef = (id: string) => (el: E | null) => {
    if (el) {
      els.current.set(id, el);
      return;
    }
    const was = els.current.get(id);
    if (was?.contains(was.ownerDocument.activeElement)) held.current.add(id);
    els.current.delete(id);
  };

  useLayoutEffect(() => {
    const before = drawn.current;
    drawn.current = rows;
    const gone = before.find((r) => held.current.has(r.id) && !els.current.has(r.id));
    held.current.clear();
    if (!gone) return;
    // Something else took focus in the same commit: leave it there.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const heir = heirOf(before, gone.id, (id) => els.current.has(id));
    if (heir != null) focus(heir, els.current);
  });

  return { els, rowRef };
}
