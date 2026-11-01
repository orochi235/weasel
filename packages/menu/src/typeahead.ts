import {
  typeaheadMatch as matchIn, typeaheadStep as stepIn, type TypeaheadBuffer, type TypeaheadShape,
} from '@weasel-js/ui-logic';
import { isRow, type MenuEntry } from './entries';

const MENU_TYPEAHEAD: TypeaheadShape<MenuEntry> = { canStop: isRow, label: (e) => (isRow(e) ? e.label : '') };

/** The row a typed `query` lands on, searching forward from `from` with
 *  wrap. A one-letter query starts after the highlight so repeating a letter
 *  cycles; a longer one starts at it so typing on keeps the match. */
export function typeaheadMatch(entries: readonly MenuEntry[], from: number | null, query: string): number | null {
  return matchIn(entries, from, query, MENU_TYPEAHEAD);
}

/** One typed character: the new buffer and the row it lands on. */
export function typeaheadStep(
  entries: readonly MenuEntry[], from: number | null, buffer: TypeaheadBuffer, key: string, now: number,
): { buffer: TypeaheadBuffer; hit: number | null } {
  return stepIn(entries, from, buffer, key, now, MENU_TYPEAHEAD);
}
