import { BASE } from './base-glyphs.mjs';
import { ARROWS, HIERARCHY } from './arrows.mjs';
import { CAMERA } from './camera.mjs';
import { CHROME } from './chrome.mjs';
import { FILES } from './files.mjs';
import { SIZE } from './size.mjs';
import { ACTIONS } from './actions.mjs';
import { INSTRUMENT, PLAYBACK, STATUS } from './state.mjs';
import { PAGING } from './paging.mjs';
import { LAYOUT } from './layout.mjs';
import { FORM } from './form.mjs';
import { REPO } from './repo.mjs';
import { ARCS } from './arcs.mjs';
import { CURVES } from './curves.mjs';
import { SOLIDS } from './solids.mjs';
import { TEXT } from './text.mjs';
import { APPEARANCE } from './appearance.mjs';
import { VARIANTS } from './variants.mjs';
import { MARKS } from './marks.mjs';
import { KEYS } from './keys.mjs';

export const namespace = 'ui';
export const owner = '@weasel-js/ui';
export const rename = { zoom: 'zoomIn' };

// The group whose glyphs `<Icon mark>` takes.
export const markGroup = 'Marks';

export const groups = [
  ['View and lifecycle', BASE],
  ['Actions', ACTIONS],
  ['Character styling', TEXT],
  ['Playback', PLAYBACK],
  ['Paging', PAGING],
  ['Arrows', ARROWS],
  ['Key legends', KEYS],
  ['Hierarchy', HIERARCHY],
  ['Size', SIZE],
  ['Camera moves', CAMERA],
  ['App chrome', CHROME],
  ['Files', FILES],
  ['State', STATUS],
  ['Appearance', APPEARANCE],
  ['Component variants', VARIANTS],
  ['Instrument', INSTRUMENT],
  ['Workspace layout', LAYOUT],
  ['Settings form', FORM],
  ['Repository views', REPO],
  [markGroup, MARKS],
  ['Arc profiles', ARCS],
  ['Curves', CURVES],
  ['Platonic solids', SOLIDS],
];
