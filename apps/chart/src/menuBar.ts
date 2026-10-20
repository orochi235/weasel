import { pref, type PrefGroup } from '@weasel-js/prefs';

/** A menu's runs: each is a group of items, set off from the next by a separator. */
export type MenuRuns = Record<string, PrefGroup>;

export interface ChartMenuContributions {
  file?: MenuRuns;
  edit?: MenuRuns;
  view?: MenuRuns;
  format?: MenuRuns;
  arrange?: MenuRuns;
  page?: MenuRuns;
  mode?: MenuRuns;
}

/** A run of menu items from `{ key: actionId }`. */
export const run = (ids: Record<string, string>): PrefGroup =>
  pref.group('', Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, pref.action(id)])));

const menu = (title: string, access: string, runs: MenuRuns): PrefGroup =>
  pref.group(title, runs, { as: 'menu', access });

/** WeaselChart's menu bar. Chart and pipeline mode add their items through `contributions`. */
export function chartMenuBar(contributions: ChartMenuContributions = {}): PrefGroup {
  return pref.group('Menu bar', {
    file: menu('File', 'f', contributions.file ?? {}),
    edit: menu('Edit', 'e', contributions.edit ?? {}),
    ...(contributions.view !== undefined ? { view: menu('View', 'v', contributions.view) } : {}),
    ...(contributions.format ? { format: menu('Format', 'o', contributions.format) } : {}),
    ...(contributions.arrange ? { arrange: menu('Arrange', 'a', contributions.arrange) } : {}),
    ...(contributions.page ? { page: menu('Page', 'p', contributions.page) } : {}),
    mode: menu('Mode', 'm', contributions.mode ?? {}),
  }, { as: 'bar' });
}
