import { treeKey, type TreeShape } from './tree';

/** How a list's items are read: which ones the highlight can land on, and which way its arrows run. */
export interface ListShape<T> {
  /** Whether the highlight can land on `item`. A separator or a heading can't. Default: every item. */
  canStop?(item: T): boolean;
  /** Which arrow keys move the highlight. `'both'` answers to all four, the way a radio group does. Default `'vertical'`. */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** The inline direction the items are laid out in. Under `'rtl'` Left steps forward and Right back. Default `'ltr'`. */
  dir?: 'ltr' | 'rtl';
  /** An arrow past either end comes round to the other. Default true. */
  wrap?: boolean;
}

const always = () => true;

/** Index of the first item the highlight can land on, or null for a list with none. */
export function firstStop<T>(items: readonly T[], shape: ListShape<T> = {}): number | null {
  const i = items.findIndex(shape.canStop ?? always);
  return i < 0 ? null : i;
}

/** The next item the highlight can land on from `from` in direction `dir`; from `null`, the first or last.
 *  Without wrap, an end stays where it is. Null for a list with no such item. */
export function stepStop<T>(
  items: readonly T[], from: number | null, dir: 1 | -1, shape: ListShape<T> = {},
): number | null {
  const canStop = shape.canStop ?? always;
  const wrap = shape.wrap ?? true;
  const n = items.length;
  let i = from ?? (dir === 1 ? -1 : n);
  for (let k = 0; k < n; k++) {
    i += dir;
    if (i < 0 || i >= n) {
      if (!wrap) break;
      i = (i + n) % n;
    }
    if (canStop(items[i]!)) return i;
  }
  return !wrap && from !== null && canStop(items[from]!) ? from : null;
}

/** What one key does to a list's highlight. `handled` false for a key that is not the list's to move. */
export type RovingResult = { handled: false } | { handled: true; at: number | null };

/** Which way an arrow key steps a list of `shape`: 1, -1, or 0 for a key that is not one of its arrows. */
function arrowDir(key: string, shape: ListShape<unknown>): 1 | -1 | 0 {
  const orientation = shape.orientation ?? 'vertical';
  if (orientation !== 'horizontal') {
    if (key === 'ArrowDown') return 1;
    if (key === 'ArrowUp') return -1;
  }
  if (orientation !== 'vertical') {
    const forward = shape.dir === 'rtl' ? -1 : 1;
    if (key === 'ArrowRight') return forward;
    if (key === 'ArrowLeft') return -forward as 1 | -1;
  }
  return 0;
}

/** Move the highlight `at` by one key: the arrows along the list's orientation, Home and End. */
export function rovingKey<T>(items: readonly T[], at: number | null, key: string, shape: ListShape<T> = {}): RovingResult {
  if (key === 'Home') return { handled: true, at: stepStop(items, null, 1, shape) };
  if (key === 'End') return { handled: true, at: stepStop(items, null, -1, shape) };
  const dir = arrowDir(key, shape as ListShape<unknown>);
  return dir === 0 ? { handled: false } : { handled: true, at: stepStop(items, at, dir, shape) };
}

/** A key as {@link rowKey} reads it: the key and the modifiers held. */
export interface KeyPress {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/** A list of rows, and which of the keys past the arrows its caller answers. */
export interface RowKeysShape<T> extends ListShape<T> {
  /** Set for a list that folds: Right and Left open, close, and walk it ({@link treeKey}). */
  tree?: TreeShape<T>;
  /** Cmd/Ctrl+A selects every row. */
  selectAll?: boolean;
  /** Enter and Space activate a row. */
  activate?: boolean;
  /** Typing a character searches the rows' text. */
  typeahead?: boolean;
}

/** What one key on a row asks for, for the caller to carry out. */
export type RowKeyAction =
  /** Select every row. */
  | { kind: 'selectAll' }
  /** Move to row `at`, extending a range from the anchor when `extend`. `at` null takes the key without moving. */
  | { kind: 'move'; at: number | null; extend: boolean }
  /** Open or close the branch at `at`. */
  | { kind: 'toggle'; at: number }
  | { kind: 'activate' }
  /** Hand the key to typeahead. `held` when the key is the list's whether or not the search finds a row. */
  | { kind: 'type'; held: boolean };

/**
 * What a key on row `at` of a list of rows does, in the order the keys are tried: Cmd/Ctrl+A, the arrows with Home
 * and End (Shift to extend), a tree's Right and Left, a space typed mid-search, Enter or Space to activate, then any
 * other character to search. `searching` says a typeahead search is under way. Null for a key that is not the list's.
 */
export function rowKey<T>(
  items: readonly T[], at: number, press: KeyPress, shape: RowKeysShape<T> = {}, searching = false,
): RowKeyAction | null {
  const { key } = press;
  const chord = !!(press.ctrlKey || press.metaKey);
  if (shape.selectAll && key.toLowerCase() === 'a' && chord && !press.altKey && !press.shiftKey) return { kind: 'selectAll' };
  const step = rovingKey(items, at, key, shape);
  if (step.handled) return { kind: 'move', at: step.at, extend: !!press.shiftKey };
  if (shape.tree && (key === 'ArrowRight' || key === 'ArrowLeft')) {
    const t = treeKey(items, at, key, shape.tree);
    if (!t.handled) return null;
    return 'toggle' in t ? { kind: 'toggle', at: t.toggle } : { kind: 'move', at: t.at, extend: false };
  }
  // Mid-search a space is a typed character: "new f" must not activate at the space.
  if (key === ' ' && shape.typeahead && searching) return { kind: 'type', held: true };
  if (key === 'Enter' || key === ' ') return shape.activate ? { kind: 'activate' } : null;
  if (shape.typeahead && key.length === 1 && !chord && !press.altKey) return { kind: 'type', held: false };
  return null;
}
