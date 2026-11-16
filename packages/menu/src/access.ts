import { foldText } from '@weasel-js/registry';
import { isRow, type MenuEntry } from './entries';

/** The one character a declared access letter stands for: its first once composed, so `é` spelled `e` + U+0301
 *  is `é`, folded as search folds text (`foldText`). Undefined for none. */
export function accessLetter(access: string | undefined): string | undefined {
  return access ? foldText([...access.normalize('NFC')][0]!) : undefined;
}

/** Index of the first row declaring `key` as its access letter, folded alike; disabled rows included. */
export function accessMatch(entries: readonly MenuEntry[], key: string): number | null {
  const k = foldText(key);
  const i = entries.findIndex((e) => isRow(e) && accessLetter(e.access) === k);
  return i < 0 ? null : i;
}
