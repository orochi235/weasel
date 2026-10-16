import type { MenuDef } from '@weasel-js/core';

const EDIT = [
  { action: 'clipboard.cut' }, { action: 'clipboard.copy' }, { action: 'clipboard.paste' },
  { action: 'duplicate' }, { action: 'delete' },
];
const SELECTION_SECTIONS = [
  EDIT,
  [{ action: 'group' }, { action: 'ungroup' }],
  [{ action: 'reorder.forward' }, { action: 'reorder.backward' }],
  [{ action: 'enterPathEdit' }, { action: 'enterTextEdit' }],
];

/** WeaselDraw's context menus: the selection's, the empty canvas's, and a layer row's. */
export const DRAW_MENUS: MenuDef[] = [
  { id: 'draw.selection', when: { bodyTarget: 'selected-body' }, sections: SELECTION_SECTIONS },
  { id: 'draw.canvas', when: { bodyTarget: 'empty' }, sections: [
    [{ action: 'clipboard.paste' }, { action: 'selectAll' }],
    [{ action: 'undo' }, { action: 'redo' }],
  ] },
  { id: 'draw.layerRow', sections: SELECTION_SECTIONS },
];
