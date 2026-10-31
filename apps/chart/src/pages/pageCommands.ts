import { ActionDisabledReason, useCommand, type MenuDef } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { run, type MenuRuns } from '../menuBar';
import type { ChartPages } from './useChartPages';

export const PAGE_ACTIONS = {
  add: 'chart.page.add',
  remove: 'chart.page.delete',
  setup: 'chart.page.setup',
  next: 'chart.page.next',
  previous: 'chart.page.previous',
} as const;

export const PAGE_TAB_MENU_ID = 'chart.pageTab';

/** Chart mode's Page menu. */
export const PAGE_MENU: MenuRuns = {
  setup: run({ setup: PAGE_ACTIONS.setup }),
  edit: run({ add: PAGE_ACTIONS.add, remove: PAGE_ACTIONS.remove }),
  go: run({ previous: PAGE_ACTIONS.previous, next: PAGE_ACTIONS.next }),
};

/** A page tab's context menu. Its items are handed the tab's page as `params.page`. */
export const PAGE_TAB_MENUS: readonly MenuDef[] = [{
  id: PAGE_TAB_MENU_ID,
  menu: pref.group('', {
    setup: pref.group('', { setup: pref.action(PAGE_ACTIONS.setup) }),
    remove: pref.group('', { remove: pref.action(PAGE_ACTIONS.remove) }),
  }),
}];

/** The page a command acts on: the tab it was opened from, else the current page, else the first. */
function targetOf(pages: ChartPages, params?: Readonly<Record<string, unknown>>): string | null {
  const page = params?.page;
  if (typeof page === 'string') return page;
  return pages.current ?? pages.placed[0]?.id ?? null;
}

/** Registers the Page menu's commands. `openSetup` opens Page Setup on a page, and `openAdd` the page templates. */
export function usePageCommands(pages: ChartPages, openSetup: (id: string) => void, openAdd: () => void): void {
  useCommand(PAGE_ACTIONS.setup, 'Page Setup…', (params) => {
    const id = targetOf(pages, params);
    if (id !== null) openSetup(id);
  });
  useCommand(PAGE_ACTIONS.add, 'Add Page…', openAdd);
  useCommand(PAGE_ACTIONS.remove, 'Delete Page', (params) => {
    const id = targetOf(pages, params);
    if (id !== null) pages.remove(id);
  }, { enabled: () => pages.placed.length > 1 || ActionDisabledReason.NotApplicable });
  useCommand(PAGE_ACTIONS.next, 'Next Page', () => pages.step(1), { keys: { kind: 'key', key: 'PageDown' } });
  useCommand(PAGE_ACTIONS.previous, 'Previous Page', () => pages.step(-1), { keys: { kind: 'key', key: 'PageUp' } });
}
