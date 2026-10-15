/**
 * @weasel-js/menu — the headless model behind weasel's menus.
 *
 * @packageDocumentation
 */
export { entriesAt, isRow } from './entries';
export type { MenuEntry, MenuItemEntry, MenuSeparatorEntry, SubmenuEntry, MenuShortcut } from './entries';
export { placeMenu, placeSubmenu } from './placement';
export type { Point, Rect, Size } from './placement';
