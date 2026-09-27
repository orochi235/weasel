import { onCircle } from './base.mjs';

// Badge statuses. info, warn and danger are state.mjs's `info`, `warning` and
// `error`; these are the rest, drawn on the same r=7 ring so the set reads as
// one family. accent, neutral and muted are roles, not alerts, so they carry
// no mark: they are one ring at three weights of ink — solid, half, broken.

const RING = 7;
const round2 = (v) => Math.round(v * 100) / 100;

// ── success ──────────────────────────────────────────────────────────────
// `check`'s legs at the same angles and ratio, shrunk into the ring and
// bbox-centered the same way.
const SHORT = onCircle(0, 0, 2.9, 135);
const LONG = onCircle(0, 0, 6.4, 48);
const mid = [(SHORT[0] + LONG[0]) / 2, LONG[1] / 2];
const at = ([x, y]) => `${round2(x + 10 - mid[0])} ${round2(y + 10 - mid[1])}`;
const ringCheck = `M${at(SHORT)} ${at([0, 0])} ${at(LONG)}`;

// ── muted ────────────────────────────────────────────────────────────────
// The ring broken into six arcs, ink taking 60% of the circumference once the
// round caps (half the stroke at each end) are counted. Eight equal dashes
// blur to gray dots at 16px; six put a flat dash on the top and bottom rows.
const DASHES = 6;
const INK_SHARE = 0.6;
const STROKE = 1.5;
const period = 360 / DASHES;
const capDeg = (STROKE / 2 / RING) * (180 / Math.PI);
const inkDeg = period * INK_SHARE - 2 * capDeg;
const brokenRing = Array.from({ length: DASHES }, (_, i) => {
  const c = 90 + i * period;
  const [x1, y1] = onCircle(10, 10, RING, c - inkDeg / 2);
  const [x2, y2] = onCircle(10, 10, RING, c + inkDeg / 2);
  // Counterclockwise in math angle is sweep 0 in SVG's y-down frame.
  return `M${x1} ${y1}A${RING} ${RING} 0 0 0 ${x2} ${y2}`;
}).join('');

export const STATUSES = {
  'status-success': `<circle cx="10" cy="10" r="${RING}"/><path d="${ringCheck}"/>`,
  'status-accent': `<circle cx="10" cy="10" r="${RING}" fill="currentColor"/>`,
  'status-neutral': `
    <path d="M10 ${10 - RING}A${RING} ${RING} 0 0 1 10 ${10 + RING}Z" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="10" r="${RING}"/>`,
  'status-muted': `<path d="${brokenRing}"/>`,
};
