import type { ListShape } from './list';

/** How typeahead reads a list: its shape, and the text each item is found by. */
export interface TypeaheadShape<T> extends Pick<ListShape<T>, 'canStop'> {
  label(item: T): string;
}

/** How long typing can pause before the typeahead buffer starts over, in milliseconds. */
export const TYPEAHEAD_RESET_MS = 500;

/** What has been typed so far, and when the last key came. */
export interface TypeaheadBuffer {
  text: string;
  at: number;
}

/** A buffer nothing has been typed into. */
export const EMPTY_TYPEAHEAD: TypeaheadBuffer = { text: '', at: -Infinity };

/** The item a typed `query` lands on, searching forward from `from` with
 *  wrap. A one-letter query starts after the highlight so repeating a letter
 *  cycles; a longer one starts at it so typing on keeps the match. */
export function typeaheadMatch<T>(
  items: readonly T[], from: number | null, query: string, shape: TypeaheadShape<T>,
): number | null {
  const q = query.toLowerCase();
  const n = items.length;
  const start = from == null ? 0 : q.length === 1 ? from + 1 : from;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    const item = items[i]!;
    if ((shape.canStop?.(item) ?? true) && shape.label(item).toLowerCase().startsWith(q)) return i;
  }
  return null;
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
  const prev = now - buffer.at < resetMs ? buffer.text : '';
  const k = key.toLowerCase();
  const cycling = prev !== '' && [...prev].every((c) => c.toLowerCase() === k);
  const text = cycling ? key : prev + key;
  return { buffer: { text, at: now }, hit: typeaheadMatch(items, from, text, shape) };
}
