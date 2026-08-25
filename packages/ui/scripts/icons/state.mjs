import { chevron, onCircle } from './base.mjs';

// ── transport ────────────────────────────────────────────────────────────
const playTri = `M7.6 5.2 15.6 10 7.6 14.8Z`;

// ── refresh ──────────────────────────────────────────────────────────────
// Two arcs, each a third of the circle, heads on opposite ends. Distinct from
// `reset`, which is a single near-full arc.
const RR = 6.1;
const ccwTangent = (deg) => [-Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];
const cwTangent = (deg) => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];
const rf1a = onCircle(10, 10, RR, 200);
const rf1b = onCircle(10, 10, RR, 40);
const rf2a = onCircle(10, 10, RR, 20);
const rf2b = onCircle(10, 10, RR, 220);

// ── collapse / expand ────────────────────────────────────────────────────
const collapse = chevron([10, 7.8], [0, 1], 5.6, 48) + chevron([10, 12.2], [0, -1], 5.6, 48);
const expand = chevron([10, 4.4], [0, -1], 5.6, 48) + chevron([10, 15.6], [0, 1], 5.6, 48);

export const STATE = {
  // transport
  play: `<path d="${playTri}"/>`,
  pause: `<path d="M7.8 5.2v9.6M12.2 5.2v9.6"/>`,
  stop: `<rect x="5.6" y="5.6" width="8.8" height="8.8" rx="1.4"/>`,
  step: `<path d="M6.4 5.4 13 10 6.4 14.6Z"/><path d="M15.2 5.4v9.2"/>`,

  // view
  crosshair: `
    <circle cx="10" cy="10" r="5.6"/>
    <path d="M10 2.8v4.4M10 12.8v4.4M2.8 10h4.4M12.8 10h4.4"/>`,
  fullscreen: `
    <path d="M11.6 3.6h4.8v4.8M8.4 16.4H3.6v-4.8"/>
    <path d="M16.4 3.6 11.2 8.8M3.6 16.4 8.8 11.2"/>`,

  // lifecycle
  compare: `
    <rect x="3.4" y="4.6" width="13.2" height="10.8" rx="1.6"/>
    <path d="M10 4.6v10.8" stroke-width="1"/>
    <path d="M5.2 7.6h3.4M5.2 10h2.6M5.2 12.4h3.4" stroke-width="1"/>
    <path d="M11.4 7.6h3.4M11.4 10h3.4M11.4 12.4h1.8" stroke-width="1"/>`,

  // collection
  filter: `<path d="M3.4 4.6h13.2L11.8 11v5.4L8.2 14.8V11z"/>`,
  search: `<circle cx="9" cy="9" r="5.4"/><path d="M12.82 12.82 16.9 16.9"/>`,
  layers: `
    <path d="M10 2.8 17.2 6.6 10 10.4 2.8 6.6z"/>
    <path d="M2.8 10 10 13.8 17.2 10" stroke-width="1"/>
    <path d="M2.8 13.4 10 17.2 17.2 13.4" stroke-width="1"/>`,

  // state
  lock: `
    <rect x="4.6" y="9" width="10.8" height="8" rx="1.6"/>
    <path d="M7.2 9V6.6a2.8 2.8 0 0 1 5.6 0V9"/>`,
  unlock: `
    <rect x="4.6" y="9" width="10.8" height="8" rx="1.6"/>
    <path d="M7.2 9V6.6a2.8 2.8 0 0 1 5.6 0"/>`,
  visible: `
    <path d="M2.6 10C4.6 6.6 7.1 5 10 5s5.4 1.6 7.4 5c-2 3.4-4.5 5-7.4 5s-5.4-1.6-7.4-5z"/>
    <circle cx="10" cy="10" r="2.2"/>`,
  hidden: `
    <path d="M2.6 10C4.6 6.6 7.1 5 10 5s5.4 1.6 7.4 5c-2 3.4-4.5 5-7.4 5s-5.4-1.6-7.4-5z"/>
    <circle cx="10" cy="10" r="2.2"/>
    <path d="M4.2 15.8 15.8 4.2"/>`,

  pin: `
    <path d="M8.2 3.4v5.2l-2 2.6h7.6l-2-2.6V3.4z"/><path d="M7 3.4h6"/>
    <path d="M10 11.2v5.4"/>`,
  link: `
    <path d="M8.6 11.4a3.4 3.4 0 0 1 0-4.8l2.2-2.2a3.4 3.4 0 0 1 4.8 4.8l-1.1 1.1"/>
    <path d="M11.4 8.6a3.4 3.4 0 0 1 0 4.8l-2.2 2.2a3.4 3.4 0 0 1-4.8-4.8l1.1-1.1"/>`,
  collapse: `<path d="${collapse}"/>`,
  expand: `<path d="${expand}"/>`,

  // instrument
  tune: `
    <path d="M3.4 6h13.2M3.4 10h13.2M3.4 14h13.2" stroke-width="1.25"/>
    <circle cx="7" cy="6" r="1.8"/><circle cx="12.6" cy="10" r="1.8"/><circle cx="9" cy="14" r="1.8"/>`,
  grid: `
    <rect x="3.4" y="3.4" width="13.2" height="13.2" rx="1.4"/>
    <path d="M7.8 3.4v13.2M12.2 3.4v13.2M3.4 7.8h13.2M3.4 12.2h13.2" stroke-width="1"/>`,
  snap: `
    <path d="M5.4 15.6V9.4a4.6 4.6 0 0 1 9.2 0v6.2h-3.2V9.4a1.4 1.4 0 0 0-2.8 0v6.2z"/>
    <path d="M5.4 12.8h3.2M11.4 12.8h3.2" stroke-width="1"/>`,
  measure: `
    <rect x="2.6" y="7.4" width="14.8" height="5.2" rx="1.2"/>
    <path d="M6 7.4v2.2M9.4 7.4v3M12.8 7.4v2.2" stroke-width="1"/>`,
  randomize: `
    <rect x="3.6" y="3.6" width="12.8" height="12.8" rx="2"/>
    <circle cx="7.2" cy="7.2" r="1" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/>
    <circle cx="12.8" cy="12.8" r="1" fill="currentColor" stroke="none"/>`,
  refresh: `
    <path d="M${rf1a[0]} ${rf1a[1]}A${RR} ${RR} 0 0 1 ${rf1b[0]} ${rf1b[1]}"/>
    <path d="${chevron(rf1b, cwTangent(40), 2.7, 40)}"/>
    <path d="M${rf2a[0]} ${rf2a[1]}A${RR} ${RR} 0 0 1 ${rf2b[0]} ${rf2b[1]}"/>
    <path d="${chevron(rf2b, cwTangent(220), 2.7, 40)}"/>`,

  // status
  info: `
    <circle cx="10" cy="10" r="7"/>
    <path d="M10 9.4v4.4"/><path d="M10 6.5h0"/>`,
  warning: `
    <path d="M10 3.4 17.4 16.2H2.6z"/>
    <path d="M10 8.4v3.4"/><path d="M10 14h0"/>`,
  error: `
    <circle cx="10" cy="10" r="7"/>
    <path d="M7.6 7.6 12.4 12.4M12.4 7.6 7.6 12.4"/>`,
  busy: `<path d="M10 3.2A6.8 6.8 0 1 1 3.2 10"/>`,
};

export const STATE_ORDER = [
  'play', 'pause', 'stop', 'step',
  'crosshair', 'fullscreen', 'compare', 'filter',
  'search', 'layers', 'lock', 'unlock',
  'visible', 'hidden', 'pin', 'link',
  'collapse', 'expand', 'tune', 'grid',
  'snap', 'measure', 'randomize', 'refresh',
  'info', 'warning', 'error', 'busy',
];
