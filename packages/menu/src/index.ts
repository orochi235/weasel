/**
 * @weasel-js/menu — the headless model behind weasel's menus.
 *
 * @packageDocumentation
 */
export { entriesAt, isRow } from './entries';
export type { MenuEntry, MenuItemEntry, MenuSeparatorEntry, SubmenuEntry, MenuShortcut } from './entries';
export { placeMenu, placeSubmenu } from './placement';
export type { Point, Rect, Size } from './placement';
export { keyStep, firstRow } from './keys';
export type { KeyEffect, MenuStack } from './keys';
export { typeaheadMatch } from './typeahead';
export {
  createMenuController, timerScheduler, SUBMENU_OPEN_MS, DIAGONAL_GRACE_MS, TYPEAHEAD_RESET_MS,
} from './controller';
export type { MenuController, MenuControllerOptions, MenuScheduler } from './controller';
export { inTriangle } from './triangle';
