import type { MenuDef } from '@weasel-js/core';
import { EDITOR_CONTEXT_MENUS } from '@weasel-js/editor';
import { pref } from '@weasel-js/prefs';

const ENTER = pref.group('', { path: pref.action('enterPathEdit'), text: pref.action('enterTextEdit') });

const EDITOR_SELECTION = EDITOR_CONTEXT_MENUS.find((m) => m.id === 'editor.selection')!.menu;

/** The editor's selection menu with draw's part: what a layer row offers. */
const SELECTION = { ...EDITOR_SELECTION, children: { ...EDITOR_SELECTION.children, enter: ENTER } };

/** WeaselDraw's context menus: its part of the editor's selection menu, which the editor's defaults lack, and a
 *  layer row's. */
export const DRAW_MENUS: MenuDef[] = [
  { id: 'editor.selection', when: { bodyTarget: 'selected-body' }, menu: pref.group('', { enter: ENTER }) },
  { id: 'draw.layerRow', menu: SELECTION },
];
