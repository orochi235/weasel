import { ALIGN } from './align.mjs';
import { BOOLEAN } from './boolean.mjs';
import { EDIT } from './edit.mjs';
import { TOOLS } from './tools.mjs';

export const namespace = 'editing';
export const owner = '@weasel-js/editing';
export const groups = [
  ['Tools', TOOLS],
  ['Edit', EDIT],
  ['Align', ALIGN],
  ['Booleans', BOOLEAN],
];
