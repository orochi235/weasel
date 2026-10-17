import { chevron } from '../../icons/scripts/lib/base.mjs';

// The glyphs core's actions and tools default to. Drawn here with the shared helpers.

// ── delete ───────────────────────────────────────────────────────────────
const canBody = `M5.2 5.8v9.6A1.6 1.6 0 0 0 6.8 17h6.4a1.6 1.6 0 0 0 1.6-1.6V5.8`;
const canLid = `M3.6 5.8h12.8M8 5.8V4.5A1.1 1.1 0 0 1 9.1 3.4h1.8A1.1 1.1 0 0 1 12 4.5v1.3`;

// ── undo / redo ──────────────────────────────────────────────────────────
// Straight run, half-circle return. Arrowhead caps the straight end.
const undoPath = `M4.4 8.4h6.8a3.6 3.6 0 0 1 0 7.2H8.6`;
const redoPath = `M15.6 8.4H8.8a3.6 3.6 0 0 0 0 7.2H11.4`;

export const HISTORY = {
  delete: `
    <path d="${canLid}"/>
    <path d="${canBody}"/>
    <path d="M8.4 8.8v5.2M11.6 8.8v5.2" stroke-width="1"/>`,

  undo: `
    <path d="${undoPath}"/>
    <path d="${chevron([4.4, 8.4], [-1, 0], 2.7, 40)}"/>`,

  redo: `
    <path d="${redoPath}"/>
    <path d="${chevron([15.6, 8.4], [1, 0], 2.7, 40)}"/>`,

  measure: `
    <rect x="2.6" y="7.4" width="14.8" height="5.2" rx="1.2"/>
    <path d="M6 7.4v2.2M9.4 7.4v3M12.8 7.4v2.2" stroke-width="1"/>`,

  tune: `
    <path d="M3.4 6h13.2M3.4 10h13.2M3.4 14h13.2" stroke-width="1.25"/>
    <circle cx="7" cy="6" r="1.8"/><circle cx="12.6" cy="10" r="1.8"/><circle cx="9" cy="14" r="1.8"/>`,
};
