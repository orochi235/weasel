import { useEffect, useRef, type FocusEvent, type PointerEvent, type RefObject } from 'react';
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { prefersReducedMotion } from '../../reducedMotion';
import { dropSlot, isDropPath } from './drop';

/** On the element a form draws for a leaf or a group, its dotted path. */
export const PATH_ATTR = 'data-pref-path';

/** On a rail entry, the dotted path of the group it opens; empty on the entry for the root's own leaves. */
export const RAIL_ATTR = 'data-pref-rail';

/** What a form marks while it draws: the selection. */
export interface PrefMarks {
  selected?: string | null;
}

/** The attributes of the element a form draws for the leaf (`leaf`) or the group at `path`. */
export function selectionAttrs(path: string, marks: PrefMarks, leaf = false): Record<string, string | undefined> {
  // A placeholder is not in the schema, so there is nothing to select or to drop beside.
  if (isDropPath(path)) return { 'data-drop-placeholder': dropSlot(path) };
  return {
    [PATH_ATTR]: path === '' ? undefined : path,
    'data-pref-leaf': leaf ? '' : undefined,
    'data-selected': path !== '' && path === marks.selected ? '' : undefined,
  };
}

/**
 * The path a form draws something for when asked for `path`: the path itself, or the leaf it lies inside,
 * since an object leaf's fields share its row. Null when `root` holds neither.
 */
export function shownPath(root: PrefGroup | null, path: string | undefined): string | null {
  if (root === null || path === undefined || path === '') return null;
  const keys = path.split('.');
  let cursor = root;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const next = Object.hasOwn(cursor.children, key) ? cursor.children[key] : undefined;
    if (next === undefined) return null;
    if (isPrefLeaf(next)) return keys.slice(0, i + 1).join('.');
    cursor = next;
  }
  return path;
}

export interface SelectionRoot {
  ref: RefObject<HTMLDivElement | null>;
  onPointerDown?: (e: PointerEvent) => void;
  onFocus?: (e: FocusEvent) => void;
}

/**
 * Props for a form's root element: they scroll `shown` into view each time `selected` changes, and report the
 * row or group the reader presses or focuses into, a group's rail entry included.
 */
export function useSelectedRow(
  selected: string | undefined,
  shown: string | null,
  onSelect: ((path: string) => void) | undefined,
): SelectionRoot {
  const ref = useRef<HTMLDivElement | null>(null);
  const pending = useRef(false);
  const reported = useRef<string | null>(null);
  useEffect(() => {
    // A selection the reader made here is already under their pointer; scrolling it would move it mid-click.
    pending.current = selected !== undefined && selected !== reported.current;
    reported.current = null;
  }, [selected]);
  // Every render, because the element may arrive a render late: a rail opens the group that holds it first.
  useEffect(() => {
    if (!pending.current || shown === null || ref.current === null) return;
    const el = [...ref.current.querySelectorAll(`[${PATH_ATTR}]`)].find((x) => x.getAttribute(PATH_ATTR) === shown);
    if (el === undefined) return;
    pending.current = false;
    // Optional-called: jsdom's elements have no `scrollIntoView`.
    el.scrollIntoView?.({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });
  if (onSelect === undefined) return { ref };
  const pick = (e: PointerEvent | FocusEvent): void => {
    // A rail entry stands for its group as much as the group's heading in the pane does.
    const el = (e.target as Element).closest?.(`[${PATH_ATTR}], [${RAIL_ATTR}]`);
    const path = el?.getAttribute(PATH_ATTR) ?? el?.getAttribute(RAIL_ATTR);
    if (path == null || path === selected) return;
    reported.current = path;
    onSelect(path);
  };
  return { ref, onPointerDown: pick, onFocus: pick };
}
