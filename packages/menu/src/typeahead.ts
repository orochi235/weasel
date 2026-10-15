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
