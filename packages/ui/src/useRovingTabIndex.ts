import { rovingKey } from '@weasel-js/ui-logic';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';

/** Which arrow keys walk the items. `'both'` answers to all four, the way a
 *  radio group does; a one-axis toolbar leaves the cross-axis arrows to the
 *  page. Matches `aria-orientation` for the one-axis values. */
export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

/** The inline direction the items are laid out in. Under `'rtl'` Left and Right swap. */
export type RovingDirection = 'ltr' | 'rtl';

/** Options for {@link useRovingTabIndex}. */
export type UseRovingTabIndexOptions = {
  /** Selects the items inside the container, in DOM order. Items belonging to
   *  a nested roving container are its own, not this one's. Defaults to
   *  `'button, [role="button"]'`. */
  itemSelector?: string;
  /** Defaults to `'both'`. Ignored when `columns` is set. */
  orientation?: RovingOrientation;
  /** Lays the items out as a grid this many across: Left and Right step through them in reading
   *  order, and Up and Down move a row, keeping the column. See {@link rovingGridTarget}. */
  columns?: number;
  /** With `columns`, where a last row shorter than `columns` sits, so Up and Down land on the item
   *  drawn under this one. Default `'start'`. See {@link tiling}. */
  lastRow?: 'start' | 'center' | 'end';
  /** With `columns`, the elements whose items each start on a row of their own — a toolbar whose
   *  groups are each a grid. Items under none of them count as one group. */
  groupSelector?: string;
  /** Overrides the direction read from the container's computed `direction` at each keypress. */
  dir?: RovingDirection;
  /** The item that holds the tab stop while focus is outside the container —
   *  a radiogroup-style bar passes its selected index so Tab lands on the
   *  current value. Omitted, the stop stays on whichever item last had focus,
   *  starting at the first enabled one. */
  tabStopIndex?: number;
  /** Called with the destination index as arrow/Home/End navigation moves,
   *  before focus does. This is where a selection-follows-focus bar commits
   *  the value. */
  onNavigate?: (index: number) => void;
  /** Space/Enter on the item at `index`. When omitted the keypress is left
   *  alone, which on a native `<button>` produces an ordinary click. */
  onActivate?: (index: number) => void;
};

/** What {@link useRovingTabIndex} returns. Attach both to the container. */
export type RovingTabIndex<T extends HTMLElement = HTMLDivElement> = {
  rootRef: RefObject<T | null>;
  onKeyDown: (e: ReactKeyboardEvent<T>) => void;
};

const DEFAULT_ITEMS = 'button, [role="button"]';
const ROOT_ATTR = 'data-wzl-roving';

function isEnabled(el: HTMLElement): boolean {
  return !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true';
}

/** The inline direction `el` lays its children out in, from its computed `direction`. */
export function inlineDirection(el: Element): RovingDirection {
  return getComputedStyle(el).direction === 'rtl' ? 'rtl' : 'ltr';
}

const isStop = (enabled: boolean) => enabled;

/** Where `key` takes focus from `current`, or null if it does not move it.
 *  Arrows skip disabled items and wrap; Home and End go to the first and last
 *  enabled item. Under `'rtl'` Left steps forward and Right back. */
export function rovingTarget(
  current: number,
  pressed: string,
  enabled: readonly boolean[],
  orientation: RovingOrientation = 'both',
  dir: RovingDirection = 'ltr',
): number | null {
  const step = rovingKey(enabled, current, pressed, { canStop: isStop, orientation, dir });
  return step.handled ? step.at : null;
}

/** How a grid's rows sit for {@link rovingGridTarget}. */
export interface RovingGridLayout {
  dir?: RovingDirection;
  /** How many columns in each row's first item sits, by row: a short row centered in an even gap sits a half
   *  column in. Omitted rows start at column 0. */
  offsets?: readonly number[];
}

/** Which item of `row`, starting `offset` columns in, sits under the column span `lo`–`lo + 1`: of two
 *  that each half cover it, the later going down and the earlier going up, so Down then Up comes back.
 *  Under none, the nearest end. */
function itemUnder(row: readonly number[], offset: number, lo: number, down: boolean): number | undefined {
  const first = Math.max(0, Math.floor(lo - offset - 1) + 1);
  const last = Math.min(row.length - 1, Math.ceil(lo + 1 - offset) - 1);
  if (first <= last) return row[down ? last : first];
  return row[Math.min(row.length - 1, Math.max(0, Math.round(lo - offset)))];
}

/** Where `key` takes focus from `current` in a grid whose `rows` list item indices in reading
 *  order, or null if it does not move it. Left, Right, Home and End behave as {@link rovingTarget}
 *  with `'horizontal'` and the layout's `dir`. Up and Down move to the item under this one in the next row, by
 *  where each row sits (`layout.offsets`), or to that row's nearest end when none is under it; they pass over
 *  rows where that item is disabled, and stop at the first and last rows. */
export function rovingGridTarget(
  current: number,
  key: string,
  enabled: readonly boolean[],
  rows: readonly (readonly number[])[],
  layout: RovingGridLayout = {},
): number | null {
  const step = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  if (step === 0) return rovingTarget(current, key, enabled, 'horizontal', layout.dir);
  const r = rows.findIndex((row) => row.includes(current));
  if (r < 0) return null;
  const at = (row: number): number => layout.offsets?.[row] ?? 0;
  const lo = at(r) + rows[r].indexOf(current);
  for (let rr = r + step; rr >= 0 && rr < rows.length; rr += step) {
    const i = itemUnder(rows[rr], at(rr), lo, step > 0);
    if (i !== undefined && enabled[i]) return i;
  }
  return null;
}

/** How far in, in columns, a row of `length` items sits in a grid `columns` across, aligned `align`. */
export function rowOffset(length: number, columns: number, align: 'start' | 'center' | 'end' = 'start'): number {
  const gap = Math.max(0, columns - length);
  return align === 'center' ? gap / 2 : align === 'end' ? gap : 0;
}

/** `items` split into rows `columns` long, a new row starting wherever the group changes. */
function gridRows(items: readonly HTMLElement[], columns: number, groupSelector?: string): number[][] {
  const rows: number[][] = [];
  let group: Element | null | undefined;
  for (const [i, el] of items.entries()) {
    const g = groupSelector ? el.closest(groupSelector) : null;
    const row = rows[rows.length - 1];
    if (!row || g !== group || row.length >= columns) rows.push([i]);
    else row.push(i);
    group = g;
  }
  return rows;
}

/** Keeps `root`'s tab stop on the focused item, and placed again as its children change; returns the teardown. */
function listen(
  root: HTMLElement,
  items: () => HTMLElement[],
  place: (focused: HTMLElement | null) => void,
  focusedItem: () => HTMLElement | null,
  last: { current: HTMLElement | null },
): () => void {
  // Children can change without this component rendering — arbitrary
  // children re-render on their own, and `disabled` moves an item out of the
  // navigable set without touching the child list.
  const mo = new MutationObserver(() => place(focusedItem()));
  mo.observe(root, {
    childList: true,
    subtree: true,
    attributeFilter: ['disabled', 'aria-disabled'],
  });
  const onFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!items().includes(target)) return;
    last.current = target;
    place(target);
  };
  const onFocusOut = (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && root.contains(next)) return;
    place(null);
  };
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  return () => {
    mo.disconnect();
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
  };
}

/**
 * The APG roving-tabindex contract for a container of items: exactly one item
 * is in the tab order, and the arrow keys move focus among the rest, skipping
 * disabled ones (`disabled` or `aria-disabled="true"`) and wrapping at both
 * ends. Home and End go to the first and last enabled item. Under a
 * right-to-left layout — the container's computed `direction`, or the `dir`
 * option — Left and Right swap. While focus is
 * inside, the focused item holds the tab stop, so Tab and Shift+Tab both leave
 * the container.
 *
 * The items are found in the DOM and their `tabIndex` is written there, so the
 * container can hold arbitrary children; callers must not render `tabIndex` on
 * the items themselves. Adding, removing, disabling or enabling an item moves
 * the stop without the container re-rendering.
 *
 * With every item disabled there is no tab stop and the container drops out of
 * the tab order entirely.
 *
 * **When a bar should not use this.** A container of compound controls — a
 * number field, a select, a color field — must leave the arrow keys alone,
 * because those controls edit their own value with them.
 */
export function useRovingTabIndex<T extends HTMLElement = HTMLDivElement>(
  options: UseRovingTabIndexOptions = {},
): RovingTabIndex<T> {
  const { itemSelector = DEFAULT_ITEMS, orientation = 'both', columns, groupSelector } = options;
  const rootRef = useRef<T | null>(null);
  const last = useRef<HTMLElement | null>(null);
  const latest = useRef(options);

  const itemsOf = useCallback((root: HTMLElement | null): HTMLElement[] => {
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(itemSelector)).filter(
      (el) => el.parentElement?.closest(`[${ROOT_ATTR}]`) === root,
    );
  }, [itemSelector]);
  const items = useCallback((): HTMLElement[] => itemsOf(rootRef.current), [itemsOf]);
  // The container last placed in, so letting go of the ref gives its items their own tab order back.
  const placedIn = useRef<HTMLElement | null>(null);
  // The container the listeners below are on, so a ref attached after mount, or moved, gets them too.
  const [listened, setListened] = useState<T | null>(null);

  // `focused` is the item focus sits on, or null when it is outside.
  const place = useCallback(
    (focused: HTMLElement | null) => {
      const found = items();
      const enabled = found.map(isEnabled);
      const controlled = latest.current.tabStopIndex;
      let stop = focused ? found.indexOf(focused) : -1;
      if (stop < 0 && controlled !== undefined && enabled[controlled]) stop = controlled;
      if (stop < 0 && controlled === undefined && last.current) {
        const i = found.indexOf(last.current);
        if (enabled[i]) stop = i;
      }
      if (stop < 0) stop = enabled.indexOf(true);
      for (const [i, el] of found.entries()) el.tabIndex = i === stop ? 0 : -1;
    },
    [items],
  );

  const focusedItem = useCallback((): HTMLElement | null => {
    const active = document.activeElement as HTMLElement | null;
    return active && items().includes(active) ? active : null;
  }, [items]);

  // Every render, so a controlled stop or a re-rendered item set lands before paint.
  useLayoutEffect(() => {
    latest.current = options;
    const root = rootRef.current;
    const was = placedIn.current;
    if (was && was !== root) {
      for (const el of itemsOf(was)) el.removeAttribute('tabindex');
      was.removeAttribute(ROOT_ATTR);
    }
    placedIn.current = root;
    root?.setAttribute(ROOT_ATTR, '');
    place(focusedItem());
  });
  // Every render, since a ref changes without one; it sets state only when the container did.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (rootRef.current !== listened) setListened(rootRef.current);
  });

  useEffect(
    () => (listened ? listen(listened, items, place, focusedItem, last) : undefined),
    [listened, items, place, focusedItem],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<T>) => {
      const found = items();
      const current = found.indexOf(e.target as HTMLElement);
      if (current < 0) return;
      const { onActivate, onNavigate } = latest.current;
      if (e.key === ' ' || e.key === 'Enter') {
        if (!onActivate) return;
        e.preventDefault();
        onActivate(current);
        return;
      }
      const enabled = found.map(isEnabled);
      const dir = latest.current.dir ?? inlineDirection(e.currentTarget);
      const rows = columns ? gridRows(found, columns, groupSelector) : [];
      // A row short of `columns` is the last of its group, and sits where `lastRow` puts it.
      const offsets = rows.map((row) => (row.length < columns! ? rowOffset(row.length, columns!, latest.current.lastRow) : 0));
      const next = columns
        ? rovingGridTarget(current, e.key, enabled, rows, { dir, offsets })
        : rovingTarget(current, e.key, enabled, orientation, dir);
      if (next === null || next === current) return;
      e.preventDefault();
      onNavigate?.(next);
      const el = found[next];
      last.current = el;
      el.focus();
      place(el);
    },
    [items, orientation, columns, groupSelector, place],
  );

  return { rootRef, onKeyDown };
}
