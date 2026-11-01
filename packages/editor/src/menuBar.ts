import { pref, type PrefGroup } from '@weasel-js/prefs';

/** A menu's runs: each is a group of items, set off from the next by a separator. */
export type MenuRuns = Record<string, PrefGroup>;

/** What each menu title holds, by the title's key. A title with no entry is left off the bar unless it is `always`. */
export type MenuContributions = Readonly<Record<string, MenuRuns | undefined>>;

/** A title on the menu bar. */
export interface MenuTitle {
  /** The key its contribution is filed under. */
  key: string;
  title: string;
  /** The access letter that opens it. */
  access?: string;
  /** Shown even when nothing is contributed to it. */
  always?: boolean;
}

/** File and Edit, always shown; then View, Format, Arrange, and Page, each shown once something is contributed. */
export const EDITOR_MENU_TITLES: readonly MenuTitle[] = [
  { key: 'file', title: 'File', access: 'f', always: true },
  { key: 'edit', title: 'Edit', access: 'e', always: true },
  { key: 'view', title: 'View', access: 'v' },
  { key: 'format', title: 'Format', access: 'o' },
  { key: 'arrange', title: 'Arrange', access: 'a' },
  { key: 'page', title: 'Page', access: 'p' },
];

/** A run of menu items from `{ key: actionId }`. A bare id lists every variant its action has. */
export function menuRun(ids: Readonly<Record<string, string>>): PrefGroup {
  return pref.group('', Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, pref.action(id)])));
}

/** A menu title over `runs`. */
export function menu(title: string, runs: MenuRuns, access?: string): PrefGroup {
  return pref.group(title, runs, { as: 'menu', ...(access !== undefined ? { access } : {}) });
}

/** The menu bar `MenuBar` draws: a menu per title in `titles` order, from what `contributions` files under each.
 *  A contribution whose key no title names is left out. */
export function editorMenuBar(
  contributions: MenuContributions,
  titles: readonly MenuTitle[] = EDITOR_MENU_TITLES,
): PrefGroup {
  const menus: Record<string, PrefGroup> = {};
  for (const { key, title, access, always } of titles) {
    const runs = contributions[key];
    if (runs !== undefined || always) menus[key] = menu(title, runs ?? {}, access);
  }
  return pref.group('Menu bar', menus, { as: 'bar' });
}
