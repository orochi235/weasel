import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
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

const MIRRORED: Record<string, string> = { ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' };

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
  const key = dir === 'rtl' ? (MIRRORED[pressed] ?? pressed) : pressed;
  const n = enabled.length;
  const horizontal = orientation !== 'vertical';
  const vertical = orientation !== 'horizontal';
  let step = 0;
  if ((horizontal && key === 'ArrowRight') || (vertical && key === 'ArrowDown')) step = 1;
  else if ((horizontal && key === 'ArrowLeft') || (vertical && key === 'ArrowUp')) step = -1;
  else if (key === 'Home') {
    const i = enabled.indexOf(true);
    return i < 0 ? null : i;
  } else if (key === 'End') {
    const i = enabled.lastIndexOf(true);
    return i < 0 ? null : i;
  } else return null;
  for (let k = 1; k <= n; k++) {
    const i = (((current + step * k) % n) + n) % n;
    if (enabled[i]) return i;
  }
  return null;
}

/** Where `key` takes focus from `current` in a grid whose `rows` list item indices in reading
 *  order, or null if it does not move it. Left, Right, Home and End behave as {@link rovingTarget}
 *  with `'horizontal'` and the same `dir`. Up and Down keep the column, landing on the last item of a row too short
 *  to have it, pass over rows where that item is disabled, and stop at the first and last rows. */
export function rovingGridTarget(
  current: number,
  key: string,
  enabled: readonly boolean[],
  rows: readonly (readonly number[])[],
  dir: RovingDirection = 'ltr',
): number | null {
  const step = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  if (step === 0) return rovingTarget(current, key, enabled, 'horizontal', dir);
  const r = rows.findIndex((row) => row.includes(current));
  if (r < 0) return null;
  const column = rows[r].indexOf(current);
  for (let rr = r + step; rr >= 0 && rr < rows.length; rr += step) {
    const row = rows[rr];
    const i = row[Math.min(column, row.length - 1)];
    if (i !== undefined && enabled[i]) return i;
  }
  return null;
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

  const items = useCallback((): HTMLElement[] => {
    const root = rootRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(itemSelector)).filter(
      (el) => el.parentElement?.closest(`[${ROOT_ATTR}]`) === root,
    );
  }, [itemSelector]);

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
    rootRef.current?.setAttribute(ROOT_ATTR, '');
    place(focusedItem());
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
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
  }, [items, place, focusedItem]);

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
      const dir = latest.current.dir ?? (getComputedStyle(e.currentTarget).direction === 'rtl' ? 'rtl' : 'ltr');
      const next = columns
        ? rovingGridTarget(current, e.key, enabled, gridRows(found, columns, groupSelector), dir)
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
