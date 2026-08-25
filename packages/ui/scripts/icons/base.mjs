// Register A, geometry computed. Every arrowhead vertex sits exactly on the
// terminus of the stroke it caps.
//
// Arc terminus rule: `M x y A rx ry rot laf sf dx dy` ends at (x+dx, y+dy).
// Chevron rule: barbs = tip + L * rot(±spread, -travelDirection).
//
// Hairline (stroke-width 1) marks STRUCTURE only — a slide's label rules, a
// tray's fill line. Never decoration: a tick added to `reset` for flavor
// turned the glyph into the IEC power symbol.

const R = (deg) => (deg * Math.PI) / 180;
const n = (v) => Math.round(v * 100) / 100;

/** Open-V arrowhead whose vertex is exactly `tip`, trailing back along `dir`.
 *  Barb endpoints are 2*L*sin(spread) apart; if that is not comfortably wider
 *  than the stroke, the round joins merge and the V renders as a solid
 *  triangle — which reads wrong in an outlined register and is invisible at
 *  chrome size. Guard rather than eyeball it. */
const STROKE = 1.5;
const MIN_NOTCH = 1.6;

export function chevron(tip, dir, L = 2.8, spread = 32) {
  const sep = 2 * L * Math.sin(R(spread));
  if (sep - STROKE < MIN_NOTCH) {
    throw new Error(
      `chevron: barbs ${n(sep)} apart leaves a ${n(sep - STROKE)} notch (need ${MIN_NOTCH}). ` +
        `Raise L (${L}) or spread (${spread}°).`,
    );
  }
  const m = Math.hypot(dir[0], dir[1]);
  const b = [-dir[0] / m, -dir[1] / m];
  const rot = (a) => [
    b[0] * Math.cos(R(a)) - b[1] * Math.sin(R(a)),
    b[0] * Math.sin(R(a)) + b[1] * Math.cos(R(a)),
  ];
  const p = (v) => [n(tip[0] + L * v[0]), n(tip[1] + L * v[1])];
  const [x1, y1] = p(rot(spread));
  const [x2, y2] = p(rot(-spread));
  return `M${x1} ${y1} ${n(tip[0])} ${n(tip[1])} ${x2} ${y2}`;
}

/** Point on a circle at math-angle `deg` (SVG y-down). */
export const onCircle = (cx, cy, r, deg) => [
  n(cx + r * Math.cos(R(deg))),
  n(cy - r * Math.sin(R(deg))),
];

/** Unit tangent at `deg` for counterclockwise travel. */
const ccwTangent = (deg) => [-Math.sin(R(deg)), -Math.cos(R(deg))];

// ── reset ────────────────────────────────────────────────────────────────
// r=5.8 about (10,10). CCW from 118° the long way to 62°. No index tick —
// arc + vertical tick at 12 o'clock is the power symbol.
const rStart = onCircle(10, 10, 5.8, 118);
const rEnd = onCircle(10, 10, 5.8, 62);
const resetArc = `M${rStart[0]} ${rStart[1]}A5.8 5.8 0 1 0 ${rEnd[0]} ${rEnd[1]}`;
const resetHead = chevron(rEnd, ccwTangent(62), 2.9, 40);

// ── save ─────────────────────────────────────────────────────────────────
const saveHead = chevron([10, 11.7], [0, 1], 2.9, 36);

// ── pan ──────────────────────────────────────────────────────────────────
// Shafts start at the hub rim so nothing crosses the center.
const HUB = 1.9;
const panShafts = `M10 ${10 - HUB}V3.2M10 ${10 + HUB}V16.8M${10 - HUB} 10H3.2M${10 + HUB} 10H16.8`;
const panHeads = [
  chevron([10, 3.2], [0, -1], 2.7, 40),
  chevron([10, 16.8], [0, 1], 2.7, 40),
  chevron([3.2, 10], [-1, 0], 2.7, 40),
  chevron([16.8, 10], [1, 0], 2.7, 40),
].join('');

// ── zoom ─────────────────────────────────────────────────────────────────
// Handle departs the rim at exactly -45° so it meets the circle.
const zHandle = onCircle(9, 9, 5.4, -45);

export const BASE = {
  attrs:
    'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"',

  // Back slide tucks under the front rect's stroke with butt caps, so it
  // reads as occluded rather than as two tabs.
  clone: `
    <path d="M7 7.4V4.6A1.6 1.6 0 0 1 8.6 3h6.8A1.6 1.6 0 0 1 17 4.6v6.8a1.6 1.6 0 0 1-1.6 1.6H12.6"
          stroke-linecap="butt"/>
    <rect x="3" y="7" width="10" height="10" rx="1.6"/>
    <path d="M5.7 10.8h4.6M5.7 13.4h3" stroke-width="1"/>`,

  reset: `
    <path d="${resetArc}"/>
    <path d="${resetHead}"/>`,

  close: `<path d="M6.7 6.7 13.3 13.3M13.3 6.7 6.7 13.3"/>`,

  save: `
    <path d="M4 12.6v2.9A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-2.9"/>
    <path d="M10 3.2v8.5"/>
    <path d="${saveHead}"/>
    <path d="M6.8 14.7h6.4" stroke-width="1"/>`,

  zoom: `
    <circle cx="9" cy="9" r="5.4"/>
    <path d="M${zHandle[0]} ${zHandle[1]} 16.9 16.9"/>
    <path d="M9 6.7v4.6M6.7 9h4.6"/>`,

  pan: `
    <path d="${panShafts}"/>
    <path d="${panHeads}"/>
    <circle cx="10" cy="10" r="${HUB}"/>`,
};

export const BASE_ORDER = ['clone', 'reset', 'close', 'save', 'zoom', 'pan'];
