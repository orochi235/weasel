import type { MenuDef, SurfaceContribution } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';

const SELECTION = pref.group('', {
  edit: pref.group('', {
    cut: pref.action('clipboard.cut'), copy: pref.action('clipboard.copy'), paste: pref.action('clipboard.paste'),
    duplicate: pref.action('duplicate'), delete: pref.action('delete'),
  }),
  group: pref.group('', { group: pref.action('group'), ungroup: pref.action('ungroup') }),
  order: pref.group('', { forward: pref.action('reorder.forward'), backward: pref.action('reorder.backward') }),
});

const CANVAS = pref.group('', {
  edit: pref.group('', { paste: pref.action('clipboard.paste'), selectAll: pref.action('selectAll') }),
  history: pref.group('', { undo: pref.action('undo'), redo: pref.action('redo') }),
});

/** The editor's context menus: `editor.selection` on a right-click on the selection, `editor.canvas` on empty
 *  canvas. An app adds to one by contributing a def with the same id to the canvas's `ambient`; its sections follow
 *  these. */
export const EDITOR_CONTEXT_MENUS: MenuDef[] = [
  { id: 'editor.selection', when: { bodyTarget: 'selected-body' }, menu: SELECTION },
  { id: 'editor.canvas', when: { bodyTarget: 'empty' }, menu: CANVAS },
];

/** The ambient entry carrying {@link EDITOR_CONTEXT_MENUS}, which `<EditorShell>` installs on every canvas in it. */
export const EDITOR_CONTEXT_MENUS_CONTRIBUTION: SurfaceContribution = {
  id: 'editor.contextMenus',
  eligibility: { always: true },
  menus: EDITOR_CONTEXT_MENUS,
};
