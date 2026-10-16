import type { MenuDef } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';

const SELECTION = pref.group('', {
  edit: pref.group('', {
    cut: pref.action('clipboard.cut'), copy: pref.action('clipboard.copy'), paste: pref.action('clipboard.paste'),
    duplicate: pref.action('duplicate'), delete: pref.action('delete'),
  }),
  group: pref.group('', { group: pref.action('group'), ungroup: pref.action('ungroup') }),
  order: pref.group('', { forward: pref.action('reorder.forward'), backward: pref.action('reorder.backward') }),
  enter: pref.group('', { path: pref.action('enterPathEdit'), text: pref.action('enterTextEdit') }),
});

const CANVAS = pref.group('', {
  edit: pref.group('', { paste: pref.action('clipboard.paste'), selectAll: pref.action('selectAll') }),
  history: pref.group('', { undo: pref.action('undo'), redo: pref.action('redo') }),
});

/** WeaselDraw's context menus: the selection's, the empty canvas's, and a layer row's. */
export const DRAW_MENUS: MenuDef[] = [
  { id: 'draw.selection', when: { bodyTarget: 'selected-body' }, schema: SELECTION },
  { id: 'draw.canvas', when: { bodyTarget: 'empty' }, schema: CANVAS },
  { id: 'draw.layerRow', schema: SELECTION },
];
