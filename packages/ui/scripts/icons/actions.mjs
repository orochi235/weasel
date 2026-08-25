import { chevron, onCircle, BASE } from './base.mjs';

// ── delete ───────────────────────────────────────────────────────────────
const canBody = `M5.2 5.8v9.6A1.6 1.6 0 0 0 6.8 17h6.4a1.6 1.6 0 0 0 1.6-1.6V5.8`;
const canLid = `M3.6 5.8h12.8M8 5.8V4.5A1.1 1.1 0 0 1 9.1 3.4h1.8A1.1 1.1 0 0 1 12 4.5v1.3`;

// ── sort ─────────────────────────────────────────────────────────────────
const sortArrowTip = [15.3, 14.8];
const sortRules = `M3.6 5.6h7.2M3.6 10h8.8M3.6 14.4h5`;
const sortArrow = `M15.3 5.4v9.4`;

// ── undo / redo ──────────────────────────────────────────────────────────
// Straight run, half-circle return. Arrowhead caps the straight end.
const undoPath = `M4.4 8.4h6.8a3.6 3.6 0 0 1 0 7.2H8.6`;
const redoPath = `M15.6 8.4H8.8a3.6 3.6 0 0 0 0 7.2H11.4`;

// ── zoom-out ─────────────────────────────────────────────────────────────
const zHandle = onCircle(9, 9, 5.4, -45);

// ── fit ──────────────────────────────────────────────────────────────────
const fitCorners = [
  `M3.2 7.2V4.4A1.2 1.2 0 0 1 4.4 3.2h2.8`,
  `M12.8 3.2h2.8A1.2 1.2 0 0 1 16.8 4.4v2.8`,
  `M16.8 12.8v2.8a1.2 1.2 0 0 1-1.2 1.2h-2.8`,
  `M7.2 16.8H4.4a1.2 1.2 0 0 1-1.2-1.2v-2.8`,
].join('');

export const ACTIONS = {
  add: `<path d="M10 4.9v10.2M4.9 10h10.2"/>`,

  remove: `<path d="M4.9 10h10.2"/>`,

  delete: `
    <path d="${canLid}"/>
    <path d="${canBody}"/>
    <path d="M8.4 8.8v5.2M11.6 8.8v5.2" stroke-width="1"/>`,

  sort: `
    <path d="${sortRules}"/>
    <path d="${sortArrow}"/>
    <path d="${chevron(sortArrowTip, [0, 1], 2.6, 40)}"/>`,

  undo: `
    <path d="${undoPath}"/>
    <path d="${chevron([4.4, 8.4], [-1, 0], 2.7, 40)}"/>`,

  redo: `
    <path d="${redoPath}"/>
    <path d="${chevron([15.6, 8.4], [1, 0], 2.7, 40)}"/>`,

  'zoom-out': `
    <circle cx="9" cy="9" r="5.4"/>
    <path d="M${zHandle[0]} ${zHandle[1]} 16.9 16.9"/>
    <path d="M6.7 9h4.6"/>`,

  fit: `
    <path d="${fitCorners}"/>
    <rect x="7.4" y="8.2" width="5.2" height="3.6" rx="0.8" stroke-width="1"/>`,

  // Export keeps the tray-and-arrow; snapshot takes the camera. One word was
  // doing both jobs and the tray reads as download, not "capture this state".
  export: BASE.save,

  snapshot: `
    <path d="M3.8 8.3A1.4 1.4 0 0 1 5.2 6.9h1.9L8 5.1h4l.9 1.8h1.9A1.4 1.4 0 0 1 16.2 8.3v6A1.4 1.4 0 0 1 14.8 15.7H5.2A1.4 1.4 0 0 1 3.8 14.3z"/>
    <circle cx="10" cy="11" r="2.75"/>`,
};

export const ACTIONS_ORDER = [
  'add', 'remove', 'delete', 'sort',
  'undo', 'redo', 'zoom-out', 'fit',
  'export', 'snapshot',
];
