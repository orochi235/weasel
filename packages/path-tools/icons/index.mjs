import { TOOLS } from './tools.mjs';
import { COMMANDS } from './commands.mjs';
import { ANCHOR_SELECT } from './anchorSelect.mjs';
import { SPIRO_KINDS } from './spiroKinds.mjs';

export const namespace = 'path-tools';
export const owner = '@weasel-js/path-tools';
export const groups = [
  ['Tools', TOOLS],
  ['Commands', COMMANDS],
  ['Anchor selection', ANCHOR_SELECT],
  ['Spiro points', SPIRO_KINDS],
];
