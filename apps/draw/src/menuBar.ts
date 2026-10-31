import { pref, type PrefGroup } from '@weasel-js/prefs';
import { FILE_ACTIONS, FILE_NEW_MENU } from './fileCommands';
import { CHROME_ITEMS, chromeActionId } from './surfaces/chrome';

const act = (id: string) => pref.action(id);

/** A menu title: its unnamed inner groups are the runs, each set off from the next by a separator. */
const menu = (title: string, access: string, runs: Record<string, PrefGroup>): PrefGroup =>
  pref.group(title, runs, { as: 'menu', access });

const run = (ids: Record<string, string>): PrefGroup =>
  pref.group('', Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, act(id)])));

/** WeaselDraw's menu bar: File, Edit, Arrange, and View. A bare id (`reorder.forward`, `flip`) lists every variant it has. */
export const DRAW_MENU_BAR: PrefGroup = pref.group('Menu bar', {
  file: menu('File', 'f', {
    open: pref.group('', { new: FILE_NEW_MENU, open: act(FILE_ACTIONS.open), import: act(FILE_ACTIONS.import) }),
    save: run({ save: FILE_ACTIONS.save, exportPage: FILE_ACTIONS.exportPage }),
  }),
  edit: menu('Edit', 'e', {
    history: run({ undo: 'undo', redo: 'redo' }),
    clipboard: run({ cut: 'clipboard.cut', copy: 'clipboard.copy', paste: 'clipboard.paste' }),
    copies: run({ duplicate: 'duplicate', delete: 'delete' }),
    select: run({ selectAll: 'selectAll' }),
  }),
  arrange: menu('Arrange', 'a', {
    group: run({ group: 'group', ungroup: 'ungroup' }),
    order: run({ forward: 'reorder.forward', backward: 'reorder.backward' }),
    align: run({
      left: 'align.left', centerX: 'align.centerX', right: 'align.right',
      top: 'align.top', centerY: 'align.centerY', bottom: 'align.bottom',
    }),
    distribute: run({ horizontal: 'distribute.horizontal', vertical: 'distribute.vertical' }),
    flip: run({ flip: 'flip' }),
  }),
  view: menu('View', 'v', {
    toggles: run({ grid: 'view.grid', snap: 'view.snap', symmetry: 'view.symmetry' }),
    pathOverlays: run({
      direction: 'pathEdit.show.direction', comb: 'pathEdit.show.comb',
      balance: 'pathEdit.show.balance', corners: 'pathEdit.show.corners',
    }),
    zoom: run({ in: 'viewport.zoom:in', out: 'viewport.zoom:out', reset: 'viewport.zoom:reset' }),
    chrome: run(Object.fromEntries(CHROME_ITEMS.map(({ id }) => [id, chromeActionId(id)]))),
  }),
}, { as: 'bar' });
