import { useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

/** The only thing the hook needs to know about a bar's items: which are
 *  skipped by arrow navigation. */
export type RovingItem = { disabled?: boolean };

/** Options for {@link useRovingTabIndex}. */
export type UseRovingTabIndexOptions = {
  /** In the same order as the elements carrying `itemClassName`. */
  items: readonly RovingItem[];
  /** Class on the focusable element of each item, inside the container the
   *  returned `rootRef` is attached to. Their DOM order must match `items`. */
  itemClassName: string;
  /** Index that carries `tabIndex=0`. Defaults to the first enabled item; a
   *  radiogroup-style bar passes its selected index so Tab lands on the
   *  current value. */
  tabStopIndex?: number;
  /** Called with the new index as arrow/Home/End focus moves, before focus
   *  moves. This is where a selection-follows-focus bar commits the value. */
  onNavigate?: (index: number) => void;
  /** Space/Enter on the item at `index`. When omitted the keypress is left
   *  alone, which on a native `<button>` produces an ordinary click. */
  onActivate?: (index: number) => void;
};

/**
 * What {@link useRovingTabIndex} returns: a container ref plus the per-item
 * `tabIndex` and `onKeyDown` values to spread onto each item.
 */
export type RovingTabIndex<T extends HTMLElement = HTMLDivElement> = {
  /** Attach to the container element that holds the items. */
  rootRef: RefObject<T | null>;
  /** `tabIndex` value for the item at `index`. */
  tabIndexFor: (index: number) => 0 | -1;
  /** `onKeyDown` for the item at `index`. */
  onKeyDown: (index: number) => (e: ReactKeyboardEvent<HTMLElement>) => void;
};

function firstEnabledIndex(items: readonly RovingItem[]): number {
  for (let i = 0; i < items.length; i++) if (!items[i].disabled) return i;
  return -1;
}

function lastEnabledIndex(items: readonly RovingItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (!items[i].disabled) return i;
  return -1;
}

function nextEnabledIndex(items: readonly RovingItem[], from: number): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

function prevEnabledIndex(items: readonly RovingItem[], from: number): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from - k + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

/**
 * Roving tabindex for a bar of items: one item is in the tab order, and the
 * arrow keys move focus among the rest, skipping disabled ones and wrapping
 * at both ends. Home and End go to the first and last enabled item. Both axes
 * navigate, so the same bar works laid out either way.
 *
 * Backs `ActionsBar`, `OptionsBar`, and `ToggleBar`.
 *
 * **When a bar should not use this.** Only when the bar owns its items. A
 * container of arbitrary compound controls — a number field, a select, a
 * color field — must leave the arrow keys alone, because those controls edit
 * their own value with them; taking the arrows over would break the control
 * to navigate between controls. `ToolOptionsBar` is that case and keeps plain
 * DOM tab order. A bar whose items are all simple buttons is the case this
 * hook is for.
 *
 * With every item disabled there is no tab stop and the bar drops out of the
 * tab order entirely.
 */
export function useRovingTabIndex<T extends HTMLElement = HTMLDivElement>(
  options: UseRovingTabIndexOptions,
): RovingTabIndex<T> {
  const { items, itemClassName, onNavigate, onActivate } = options;
  const rootRef = useRef<T | null>(null);

  const tabStopIndex = options.tabStopIndex ?? firstEnabledIndex(items);

  const focusItem = (index: number): void => {
    const root = rootRef.current;
    if (!root) return;
    const elements = root.querySelectorAll<HTMLElement>(`.${itemClassName}`);
    elements[index]?.focus();
  };

  const onKeyDown = (index: number) => (e: ReactKeyboardEvent<HTMLElement>): void => {
    let nextIndex = -1;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = prevEnabledIndex(items, index);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = nextEnabledIndex(items, index);
        break;
      case 'Home':
        nextIndex = firstEnabledIndex(items);
        break;
      case 'End':
        nextIndex = lastEnabledIndex(items);
        break;
      case ' ':
      case 'Enter':
        if (onActivate) {
          e.preventDefault();
          onActivate(index);
        }
        return;
      default:
        return;
    }
    if (nextIndex < 0 || nextIndex === index) return;
    e.preventDefault();
    onNavigate?.(nextIndex);
    focusItem(nextIndex);
  };

  return {
    rootRef,
    tabIndexFor: (index: number) => (index === tabStopIndex ? 0 : -1),
    onKeyDown,
  };
}
