import { chevron, onCircle } from '../../icons/scripts/lib/base.mjs';

// ── settings ─────────────────────────────────────────────────────────────
// Six teeth: with eight, the valleys between them are narrower than the stroke and close up.
const TEETH = 6;
const OUTER = 7.2;
const ROOT = 5.4;
const gear =
  'M' +
  Array.from({ length: TEETH }, (_, i) => {
    const a = 90 + (i * 360) / TEETH;
    return [onCircle(10, 10, ROOT, a - 15), onCircle(10, 10, OUTER, a - 9), onCircle(10, 10, OUTER, a + 9), onCircle(10, 10, ROOT, a + 15)]
      .map((p) => p.join(' '))
      .join(' ');
  }).join(' ') +
  'Z';

export const CHROME = {
  settings: `<path d="${gear}"/><circle cx="10" cy="10" r="2.2"/>`,

  // A frame with a pane down its left side, and two rows in the pane.
  sidebar: `
    <rect x="3.2" y="4.2" width="13.6" height="11.6" rx="1.6"/>
    <path d="M8.2 4.2v11.6"/>
    <path d="M5.2 7.4h1M5.2 9.8h1" stroke-width="1"/>`,

  // Two swatches, each with the rule it names.
  legend: `
    <rect x="3.6" y="4.6" width="4" height="4" rx="0.8" fill="currentColor"/>
    <rect x="3.6" y="11.4" width="4" height="4" rx="0.8"/>
    <path d="M10.8 6.6h5.6M10.8 13.4h5.6"/>`,

  keyboard: `
    <rect x="2.6" y="5.2" width="14.8" height="9.6" rx="1.6"/>
    <path d="M5.6 8.4h0M8.5 8.4h0M11.5 8.4h0M14.4 8.4h0"/>
    <path d="M7.2 11.8h5.6"/>`,

  help: `
    <circle cx="10" cy="10" r="7"/>
    <path d="M7.9 8.2a2.1 2.1 0 1 1 3.3 1.7c-.8.5-1.2 1-1.2 1.8"/><path d="M10 14h0"/>`,

  menu: `<path d="M3.8 5.6h12.4M3.8 10h12.4M3.8 14.4h12.4"/>`,

  // Out of a box by its open corner.
  external: `
    <path d="M8.6 4.4H5.8A1.6 1.6 0 0 0 4.2 6v8.2a1.6 1.6 0 0 0 1.6 1.6H14a1.6 1.6 0 0 0 1.6-1.6v-2.8"/>
    <path d="M9.4 10.6 16.2 3.8"/>
    <path d="${chevron([16.2, 3.8], [1, -1], 4.4, 45)}"/>`,
};
