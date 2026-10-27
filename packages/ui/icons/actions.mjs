import { chevron, GRID_HEAD, px } from '../../icons/scripts/lib/base.mjs';
import { BASE } from './base-glyphs.mjs';

// delete, undo and redo are core's: packages/core/icons/history.mjs.

// ── sort ─────────────────────────────────────────────────────────────────
const sortArrowTip = [px(12), px(12)];
const sortRules = `M3.6 ${px(4)}h7.2M3.6 ${px(8)}h8.8M3.6 ${px(12)}h5`;
const sortArrow = `M${px(12)} ${px(4)}V${px(12)}`;

export const ACTIONS = {
  filter: `<path d="M3.4 4.6h13.2L11.8 11v5.4L8.2 14.8V11z"/>`,
  add: `<path d="M10 4.9v10.2M4.9 10h10.2"/>`,

  remove: `<path d="M4.9 10h10.2"/>`,

  sort: `
    <path d="${sortRules}"/>
    <path d="${sortArrow}"/>
    <path d="${chevron(sortArrowTip, [0, 1], ...GRID_HEAD)}"/>`,

  // Export keeps the tray-and-arrow; snapshot takes the camera. One word was
  // doing both jobs and the tray reads as download, not "capture this state".
  export: BASE.export,

  snapshot: `
    <path d="M3.8 8.3A1.4 1.4 0 0 1 5.2 6.9h1.9L8 5.1h4l.9 1.8h1.9A1.4 1.4 0 0 1 16.2 8.3v6A1.4 1.4 0 0 1 14.8 15.7H5.2A1.4 1.4 0 0 1 3.8 14.3z"/>
    <circle cx="10" cy="11" r="2.75"/>`,
};

export const ACTIONS_ORDER = [
  'add', 'remove', 'sort',
  'export', 'snapshot', 'filter',
];
