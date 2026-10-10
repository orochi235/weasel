import { useEffect, useRef, type FocusEvent, type PointerEvent, type RefObject } from 'react';
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';

/** On the element a form draws for a leaf or a group, its dotted path. */
export const PATH_ATTR = 'data-pref-path';

/** Where a drop would land in a form: beside the leaf at `path`, or into the group there. `''` is the root. */
export interface PrefDropMark {
  path: string;
  where: 'before' | 'after' | 'into';
  /** The mark belongs on the group's rail entry, which is what the pointer is over. */
  rail?: boolean;
}

/** What a form marks while it draws: the selection, and where a drag would drop. */
export interface PrefMarks {
  selected?: string | null;
  dropMark?: PrefDropMark | null;
}

/** The attributes of the element a form draws for the leaf (`leaf`) or the group at `path`. */
export function selectionAttrs(path: string, marks: PrefMarks, leaf = false): Record<string, string | undefined> {
  const drop = marks.dropMark;
  return {
    [PATH_ATTR]: path === '' ? undefined : path,
    'data-pref-leaf': leaf ? '' : undefined,
    'data-selected': path !== '' && path === marks.selected ? '' : undefined,
    'data-drop': drop != null && !drop.rail && path !== '' && drop.path === path ? drop.where : undefined,
  };
}

/**
 * Where a drop at a client point inside a form would land: before or after the leaf under it — by the half of its
 * row the point is in, across (`'x'`) for rows set side by side — or into the group under it. Null over neither.
 */
export function prefDropTargetAt(root: Element, x: number, y: number, split: 'x' | 'y' = 'y'): PrefDropMark | null {
  const el = root.ownerDocument.elementFromPoint?.(x, y);
  if (!el || !root.contains(el)) return null;
  const rail = el.closest('[data-pref-rail]');
  if (rail) return { path: rail.getAttribute('data-pref-rail')!, where: 'into', rail: true };
  const hit = el.closest(`[${PATH_ATTR}]`);
  if (!hit) {
    const pane = el.closest('[data-pref-into]');
    return pane ? { path: pane.getAttribute('data-pref-into')!, where: 'into' } : null;
  }
  const path = hit.getAttribute(PATH_ATTR)!;
  if (!hit.hasAttribute('data-pref-leaf')) return { path, where: 'into' };
  const r = hit.getBoundingClientRect();
  const before = split === 'x' ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
  return { path, where: before ? 'before' : 'after' };
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

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface SelectionRoot {
  ref: RefObject<HTMLDivElement | null>;
  onPointerDown?: (e: PointerEvent) => void;
  onFocus?: (e: FocusEvent) => void;
}

/**
 * Props for a form's root element: they scroll `shown` into view each time `selected` changes, and report the
 * row or group the reader presses or focuses into.
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
    el.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
  if (onSelect === undefined) return { ref };
  const pick = (e: PointerEvent | FocusEvent): void => {
    const path = (e.target as Element).closest?.(`[${PATH_ATTR}]`)?.getAttribute(PATH_ATTR);
    if (path == null || path === selected) return;
    reported.current = path;
    onSelect(path);
  };
  return { ref, onPointerDown: pick, onFocus: pick };
}
