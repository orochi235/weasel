import { ActionDisabledReason, useCommand, type MenuDef } from '@weasel-js/core';
import type { DocPages } from '@weasel-js/editor';
import { pref } from '@weasel-js/prefs';

export const PAGE_ACTIONS = {
  add: 'page.add',
  remove: 'page.delete',
  next: 'page.next',
  previous: 'page.previous',
} as const;

export const PAGE_TAB_MENU_ID = 'draw.pageTab';

/** A page tab's context menu. Its items are handed the tab's page as `params.page`. */
export const PAGE_TAB_MENUS: readonly MenuDef[] = [{
  id: PAGE_TAB_MENU_ID,
  menu: pref.group('', { remove: pref.group('', { remove: pref.action(PAGE_ACTIONS.remove) }) }),
}];

/** The page a command acts on: the tab it was opened from, else the shown page. */
function targetOf(pages: DocPages, params?: Readonly<Record<string, unknown>>): string | null {
  const page = params?.page;
  return typeof page === 'string' ? page : pages.shown?.id ?? null;
}

/** Registers the page commands: add, delete, and the next and previous page on Page Down and Page Up. */
export function usePageCommands(pages: DocPages): void {
  useCommand(PAGE_ACTIONS.add, 'Add Page', () => pages.add());
  useCommand(PAGE_ACTIONS.remove, 'Delete Page', (params) => {
    const id = targetOf(pages, params);
    if (id !== null) pages.remove(id);
  }, { enabled: () => pages.placed.length > 1 || ActionDisabledReason.NotApplicable });
  useCommand(PAGE_ACTIONS.next, 'Next Page', () => pages.step(1), { keys: { kind: 'key', key: 'PageDown' } });
  useCommand(PAGE_ACTIONS.previous, 'Previous Page', () => pages.step(-1), { keys: { kind: 'key', key: 'PageUp' } });
}
