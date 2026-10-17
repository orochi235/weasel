import { isRow, type MenuEntry } from './entries';

/** The one character a declared access letter stands for: its first, ignoring case. Undefined for none. */
export function accessLetter(access: string | undefined): string | undefined {
  return access ? [...access][0]!.toLowerCase() : undefined;
}

/** Index of the first row declaring `key` as its access letter, ignoring case; disabled rows included. */
export function accessMatch(entries: readonly MenuEntry[], key: string): number | null {
  const k = key.toLowerCase();
  const i = entries.findIndex((e) => isRow(e) && accessLetter(e.access) === k);
  return i < 0 ? null : i;
}
