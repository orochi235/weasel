import { editorMenuBar, type MenuContributions, menuRun, type MenuTitle } from '@weasel-js/editor';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { FILE_ACTIONS, FILE_NEW_MENU } from './fileCommands';
import { CHROME_ITEMS, chromeActionId } from './surfaces/chrome';

const act = (id: string) => pref.action(id);

/** WeaselDraw's menu titles: File, Edit, Arrange, and View. */
export const DRAW_MENU_TITLES: readonly MenuTitle[] = [
  { key: 'file', title: 'File', access: 'f' },
  { key: 'edit', title: 'Edit', access: 'e' },
  { key: 'arrange', title: 'Arrange', access: 'a' },
  { key: 'view', title: 'View', access: 'v' },
];

/** What each of WeaselDraw's menus holds. A bare id (`reorder.forward`, `flip`) lists every variant it has. */
export const DRAW_MENU_CONTRIBUTIONS: MenuContributions = {
  file: {
    open: pref.group('', { new: FILE_NEW_MENU, open: act(FILE_ACTIONS.open), import: act(FILE_ACTIONS.import) }),
    save: menuRun({ save: FILE_ACTIONS.save, exportPage: FILE_ACTIONS.exportPage }),
  },
  edit: {
    history: menuRun({ undo: 'undo', redo: 'redo' }),
    clipboard: menuRun({ cut: 'clipboard.cut', copy: 'clipboard.copy', paste: 'clipboard.paste' }),
    copies: menuRun({ duplicate: 'duplicate', delete: 'delete' }),
    select: menuRun({ selectAll: 'selectAll' }),
  },
  arrange: {
    group: menuRun({ group: 'group', ungroup: 'ungroup' }),
    order: menuRun({ forward: 'reorder.forward', backward: 'reorder.backward' }),
    align: menuRun({
      left: 'align.left', centerX: 'align.centerX', right: 'align.right',
      top: 'align.top', centerY: 'align.centerY', bottom: 'align.bottom',
    }),
    distribute: menuRun({ horizontal: 'distribute.horizontal', vertical: 'distribute.vertical' }),
    flip: menuRun({ flip: 'flip' }),
  },
  view: {
    toggles: menuRun({ grid: 'view.grid', snap: 'view.snap', symmetry: 'view.symmetry' }),
    pathOverlays: menuRun({
      direction: 'pathEdit.show.direction', comb: 'pathEdit.show.comb',
      balance: 'pathEdit.show.balance', corners: 'pathEdit.show.corners',
    }),
    zoom: menuRun({ in: 'viewport.zoom:in', out: 'viewport.zoom:out', reset: 'viewport.zoom:reset' }),
    chrome: menuRun(Object.fromEntries(CHROME_ITEMS.map(({ id }) => [id, chromeActionId(id)]))),
  },
};

/** WeaselDraw's menu bar, as `<EditorShell>` draws it from {@link DRAW_MENU_CONTRIBUTIONS}. */
export const DRAW_MENU_BAR: PrefGroup = editorMenuBar(DRAW_MENU_CONTRIBUTIONS, DRAW_MENU_TITLES);
