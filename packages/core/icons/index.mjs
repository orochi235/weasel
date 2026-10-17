import { TOOLS } from './tools.mjs';
import { EDIT } from './edit.mjs';
import { ALIGN } from './align.mjs';
import { DISTRIBUTE } from './distribute.mjs';
import { BOOLEAN } from './boolean.mjs';
import { PATH } from './path.mjs';
import { ANCHOR } from './anchor.mjs';
import { OUTLINE } from './outline.mjs';
import { HISTORY } from './history.mjs';

export const namespace = 'core';
export const owner = '@weasel-js/core';
export const groups = [
  ['Tools', TOOLS],
  ['Edit', EDIT],
  ['History', HISTORY],
  ['Align', ALIGN],
  ['Distribute', DISTRIBUTE],
  ['Booleans', BOOLEAN],
  ['Path commands', PATH],
  ['Anchors', ANCHOR],
  ['Outline', OUTLINE],
];
