import { BASE } from './base-glyphs.mjs';
import { ARROWS, HIERARCHY } from './arrows.mjs';
import { CAMERA } from './camera.mjs';
import { CHROME } from './chrome.mjs';
import { FILES } from './files.mjs';
import { SIZE } from './size.mjs';
import { ACTIONS } from './actions.mjs';
import { INSTRUMENT, PLAYBACK, STATUS } from './state.mjs';
import { PAGING } from './paging.mjs';
import { PAINT } from './paint.mjs';
import { LAYOUT } from './layout.mjs';
import { FORM } from './form.mjs';
import { REPO } from './repo.mjs';
import { ARCS } from './arcs.mjs';
import { CURVES } from './curves.mjs';
import { SHAPES } from './shapes.mjs';
import { SOLIDS } from './solids.mjs';
import { PARAGRAPH, TEXT } from './text.mjs';
import { STATUSES } from './status.mjs';
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
  ['Paragraph alignment', PARAGRAPH],
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
  ['Badge status', STATUSES],
  ['Component variants', VARIANTS],
  ['Instrument', INSTRUMENT],
  ['Stroke cap, join, align and dash', PAINT],
  ['Workspace layout', LAYOUT],
  ['Settings form', FORM],
  ['Repository views', REPO],
  [markGroup, MARKS],
  ['Arc profiles', ARCS],
  ['Curves', CURVES],
  ['Shapes', SHAPES],
  ['Platonic solids', SOLIDS],
];
