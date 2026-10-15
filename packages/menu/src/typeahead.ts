import { isRow, type MenuEntry } from './entries';

/** The row a typed `query` lands on, searching forward from `from` with
 *  wrap. A one-letter query starts after the highlight so repeating a letter
 *  cycles; a longer one starts at it so typing on keeps the match. */
export function typeaheadMatch(
  entries: readonly MenuEntry[],
  from: number | null,
  query: string,
): number | null {
  const q = query.toLowerCase();
  const n = entries.length;
  const start = from == null ? 0 : q.length === 1 ? from + 1 : from;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    const e = entries[i]!;
    if (isRow(e) && e.label.toLowerCase().startsWith(q)) return i;
  }
  return null;
}

export const TYPEAHEAD_RESET_MS = 500;

export interface TypeaheadBuffer {
  text: string;
  at: number;
}

/** One typed character: the new buffer and the row it lands on. A key that
 *  repeats the whole buffer searches that one letter, so it cycles. */
export function typeaheadStep(
  entries: readonly MenuEntry[],
  from: number | null,
  buffer: TypeaheadBuffer,
  key: string,
  now: number,
): { buffer: TypeaheadBuffer; hit: number | null } {
  const prev = now - buffer.at < TYPEAHEAD_RESET_MS ? buffer.text : '';
  const k = key.toLowerCase();
  const cycling = prev !== '' && [...prev].every((c) => c.toLowerCase() === k);
  const text = cycling ? key : prev + key;
  return { buffer: { text, at: now }, hit: typeaheadMatch(entries, from, text) };
}
