import { isRow, type MenuEntry } from './entries';

/** Index of the first row declaring `key` as its access letter, ignoring case; disabled rows included. */
export function accessMatch(entries: readonly MenuEntry[], key: string): number | null {
  const k = key.toLowerCase();
  const i = entries.findIndex((e) => isRow(e) && e.access?.toLowerCase() === k);
  return i < 0 ? null : i;
}
