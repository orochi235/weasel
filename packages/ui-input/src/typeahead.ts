import { heldAt } from './heldAt';
import type { ListShape } from './list';

/** How typeahead reads a list: its shape, and the text each item is found by. */
export interface TypeaheadShape<T> extends Pick<ListShape<T>, 'canStop'> {
  label(item: T): string;
}

/** How long typing can pause before the typeahead buffer starts over, in milliseconds. */
export const TYPEAHEAD_RESET_MS = 500;

/** Whether `text` is one typed character, counted by code point: an emoji is one, though it takes two UTF-16 units. */
export function isOneChar(text: string): boolean {
  return text.length > 0 && text.length <= 2 && [...text].length === 1;
}

/** What has been typed so far, and when the last key came. */
export interface TypeaheadBuffer {
  text: string;
  at: number;
}

/** A buffer nothing has been typed into. */
export const EMPTY_TYPEAHEAD: TypeaheadBuffer = { text: '', at: -Infinity };

/** Whether a search is under way at `now`: something typed, and less than `resetMs` ago. A space typed then is
 *  part of the search, not an activation. */
export function typeaheadSearching(buffer: TypeaheadBuffer, now: number, resetMs: number = TYPEAHEAD_RESET_MS): boolean {
  return buffer.text !== '' && now - buffer.at < resetMs;
}

/** The item a typed `query` lands on, searching forward from `at` with
 *  wrap. A one-letter query starts after the highlight so repeating a letter
 *  cycles; a longer one starts at it so typing on keeps the match. An index
 *  that names no item searches from the start. */
export function typeaheadMatch<T>(
  items: readonly T[], at: number | null, query: string, shape: TypeaheadShape<T>,
): number | null {
  const q = fold(query);
  const n = items.length;
  const from = heldAt(n, at);
  const start = from == null ? 0 : isOneChar(query) ? from + 1 : from;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    const item = items[i]!;
    if ((shape.canStop?.(item) ?? true) && fold(shape.label(item)).startsWith(q)) return i;
  }
  return null;
}

/** `s` lowercased and composed, so a label spelling `é` as `e` + U+0301 is found by typing `é`. */
function fold(s: string): string {
  return s.toLowerCase().normalize('NFC');
}

/** One typed character: the new buffer and the item it lands on. A key that
 *  repeats the whole buffer searches that one letter, so it cycles. */
export function typeaheadStep<T>(
  items: readonly T[],
  from: number | null,
  buffer: TypeaheadBuffer,
  key: string,
  now: number,
  shape: TypeaheadShape<T>,
  resetMs: number = TYPEAHEAD_RESET_MS,
): { buffer: TypeaheadBuffer; hit: number | null } {
  const prev = typeaheadSearching(buffer, now, resetMs) ? buffer.text : '';
  const k = key.toLowerCase();
  const cycling = prev !== '' && [...prev].every((c) => c.toLowerCase() === k);
  const text = cycling ? key : prev + key;
  return { buffer: { text, at: now }, hit: typeaheadMatch(items, from, text, shape) };
}
