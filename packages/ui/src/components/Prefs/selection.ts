import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { prefersReducedMotion } from '@weasel-js/react';
import { dropSlot, isDropPath } from './drop';
import { hiddenAttrs, marksHidden } from './hidden';
import './selection.css';

/** On the element a form draws for a leaf or a group, its dotted path. */
export const PATH_ATTR = 'data-pref-path';

/** On a rail entry, the dotted path of the group it opens; empty on the entry for the root's own leaves. */
export const RAIL_ATTR = 'data-pref-rail';

/** What `selection.css` draws the selection mark on. An open react-aria tab carries `data-selected` of its own, so a tab is marked by {@link tabAttrs}. */
export const MARKED = "[data-pref-path][data-selected]:not([role='tab']), [data-pref-path][data-pref-picked]";

/** What a form marks while it draws: the selection, and the nodes a `showIf` hides where it draws those. */
export interface PrefMarks {
  selected?: readonly string[];
  hidden?: ReadonlySet<string>;
}

/** How a row was picked. */
export interface PrefSelectHow {
  /** Cmd or Ctrl was held: the row joins or leaves the selection. */
  toggle: boolean;
  /** Shift was held, alone: the rows drawn from the first selected to the one picked, in that order, the two
   *  included. Absent where the first selected is not drawn, as on another page, and the pick is a plain one. */
  range?: readonly string[];
}

/** The attributes of the element a form draws for the leaf (`leaf`) or the group at `path`. */
export function selectionAttrs(path: string, marks: PrefMarks, leaf = false): Record<string, string | undefined> {
  // A placeholder is not in the schema, so there is nothing to select or to drop beside.
  if (isDropPath(path)) return { 'data-drop-placeholder': dropSlot(path) };
  return {
    [PATH_ATTR]: path === '' ? undefined : path,
    'data-pref-leaf': leaf ? '' : undefined,
    'data-selected': path !== '' && marks.selected?.includes(path) ? '' : undefined,
    ...hiddenAttrs(marksHidden(marks.hidden, path)),
  };
}

/** The attributes of the tab a form draws for the group at `path`. The open tab's mark is its panel's, so a selection is drawn once. */
export function tabAttrs(path: string, marks: PrefMarks, open: boolean): Record<string, string | undefined> {
  const { 'data-selected': picked, ...rest } = selectionAttrs(path, marks);
  return { ...rest, 'data-pref-picked': open ? undefined : picked };
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

/** Whether `selected` is `path` or lies beneath it. */
export const pathWithin = (path: string, selected: string | null | undefined): boolean =>
  selected != null && (selected === path || selected.startsWith(`${path}.`));

/**
 * The open one of a run of tabs, and its setter. `holder` is the tab `lead` lies in, if any: a selection inside
 * another tab opens that tab once, when it arrives, and the reader may then leave it.
 */
export function useHeldTab(
  ids: readonly string[],
  holder: string | undefined,
  lead: string | null | undefined,
): [open: string, pick: (id: string) => void] {
  const [picked, setPicked] = useState(holder ?? ids[0]!);
  const [seen, setSeen] = useState(lead);
  if (seen !== lead) {
    setSeen(lead);
    if (holder !== undefined && holder !== picked) setPicked(holder);
  }
  return [ids.find((id) => id === picked) ?? ids[0]!, setPicked];
}

/** The paths `root` draws from `anchor` to `path`, in that order: the two, and each leaf's row between them. Null
 *  where it draws either one nowhere. */
function drawnRange(root: Element | null, anchor: string | undefined, path: string): string[] | null {
  if (root === null || anchor === undefined) return null;
  const els = [...root.querySelectorAll(`[${PATH_ATTR}]`)];
  const from = els.findIndex((el) => el.getAttribute(PATH_ATTR) === anchor);
  const to = els.findIndex((el) => el.getAttribute(PATH_ATTR) === path);
  if (from < 0 || to < 0) return null;
  const between = els.slice(Math.min(from, to), Math.max(from, to) + 1)
    .filter((el) => el.hasAttribute('data-pref-leaf'))
    .map((el) => el.getAttribute(PATH_ATTR)!);
  if (from > to) between.reverse();
  return [...new Set([anchor, ...between, path])];
}

export interface SelectionRoot {
  ref: RefObject<HTMLDivElement | null>;
  onPointerDownCapture?: (e: PointerEvent) => void;
  onPointerDown?: (e: PointerEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  onClick?: (e: MouseEvent) => void;
}

/**
 * Props for a form's root element: they scroll `shown` into view each time the last of `selected` changes, and
 * report the row or group the reader presses or focuses into, a group's rail entry included.
 */
export function useSelectedRow(
  selected: readonly string[],
  shown: string | null,
  onSelect: ((path: string, how: PrefSelectHow) => void) | undefined,
): SelectionRoot {
  const ref = useRef<HTMLDivElement | null>(null);
  const pending = useRef(false);
  const reported = useRef<string | null>(null);
  const lead = selected.at(-1);
  useEffect(() => {
    // A selection the reader made here is already under their pointer; scrolling it would move it mid-click.
    pending.current = lead !== undefined && lead !== reported.current;
    reported.current = null;
  }, [lead]);
  // A press on one of several selected rows waits for the click: it may be the start of a drag of them all.
  const held = useRef<string | null>(null);
  // The focus that follows a press is the same pick, not a second one.
  const pressed = useRef<string | null>(null);
  const captured = useRef(false);
  // Every render, because the element may arrive a render late: a rail opens the group that holds it first.
  useEffect(() => {
    if (!pending.current || shown === null || ref.current === null) return;
    const found = [...ref.current.querySelectorAll(`[${PATH_ATTR}]`)].find((x) => x.getAttribute(PATH_ATTR) === shown);
    // A fragment has no box of its own to scroll to; its first row stands for it.
    const el = found && getComputedStyle(found).display === 'contents' ? found.firstElementChild ?? found : found;
    if (el === undefined) return;
    pending.current = false;
    // Optional-called: jsdom's elements have no `scrollIntoView`.
    el.scrollIntoView?.({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });
  if (onSelect === undefined) return { ref };
  const pathAt = (e: { target: EventTarget }): string | null => {
    // A rail entry stands for its group as much as the group's heading in the pane does.
    const el = (e.target as Element).closest?.(`[${PATH_ATTR}], [${RAIL_ATTR}]`);
    return el?.getAttribute(PATH_ATTR) ?? el?.getAttribute(RAIL_ATTR) ?? null;
  };
  const report = (path: string, toggle: boolean, range?: readonly string[] | null): void => {
    reported.current = path;
    onSelect(path, range ? { toggle, range } : { toggle });
  };
  const press = (e: PointerEvent): void => {
    const path = pathAt(e);
    held.current = null;
    pressed.current = path;
    // A press that becomes a drag ends with no click, and its pointer may come up outside the form.
    const doc = e.currentTarget.ownerDocument;
    const release = (): void => {
      pressed.current = null;
      doc.removeEventListener('pointerup', release, true);
      doc.removeEventListener('pointercancel', release, true);
    };
    doc.addEventListener('pointerup', release, true);
    doc.addEventListener('pointercancel', release, true);
    if (path === null) return;
    // With Alt as well the press is the start of an alias drag, not a toggle.
    if ((e.metaKey || e.ctrlKey) && !e.altKey) report(path, true);
    else if (e.shiftKey && !e.altKey) report(path, false, drawnRange(ref.current, selected[0], path));
    else if (!selected.includes(path)) report(path, false);
    else if (selected.length > 1) held.current = path;
  };
  return {
    ref,
    // A react-aria tab keeps its pointer events, so its press is read on the way down or not at all.
    onPointerDownCapture: (e) => {
      captured.current = (e.target as Element).closest?.('[role="tab"]') != null;
      if (captured.current) press(e);
    },
    onPointerDown: (e) => {
      if (!captured.current) press(e);
    },
    onClick: (e) => {
      const path = held.current;
      held.current = null;
      pressed.current = null;
      if (path !== null && pathAt(e) === path) report(path, false);
    },
    onFocus: (e) => {
      const path = pathAt(e);
      if (path === null || path === pressed.current || selected.includes(path)) return;
      report(path, false);
    },
  };
}
