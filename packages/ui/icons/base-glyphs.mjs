import { n, R, STROKE, chevron, GRID_HEAD, onCircle, px, TRAY } from '../../icons/scripts/lib/base.mjs';

/** Unit tangent at `deg` for counterclockwise travel. */
const ccwTangent = (deg) => [-Math.sin(R(deg)), -Math.cos(R(deg))];

// ── reset ────────────────────────────────────────────────────────────────
// r=5.8 about (10,10). CCW from 118° the long way to 62°. No index tick —
// arc + vertical tick at 12 o'clock is the power symbol.
const rStart = onCircle(10, 10, 5.8, 118);
const rEnd = onCircle(10, 10, 5.8, 62);
const resetArc = `M${rStart[0]} ${rStart[1]}A5.8 5.8 0 1 0 ${rEnd[0]} ${rEnd[1]}`;
const resetHead = chevron(rEnd, ccwTangent(62), 2.9, 40);

// ── export ───────────────────────────────────────────────────────────────
const exportHead = chevron([px(7), px(9)], [0, 1], ...GRID_HEAD);

// ── pan ──────────────────────────────────────────────────────────────────
// Shafts start at the hub rim so nothing crosses the center, which is pixel 7's; the tips are on pixels 1
// and 13, far enough out that neighboring barbs stay apart.
const HUB = 1.9;
const PAN = px(7);
const panShafts = `M${PAN} ${PAN - HUB}V${px(1)}M${PAN} ${PAN + HUB}V${px(13)}M${PAN - HUB} ${PAN}H${px(1)}M${PAN + HUB} ${PAN}H${px(13)}`;
const panHeads = [
  chevron([PAN, px(1)], [0, -1], ...GRID_HEAD),
  chevron([PAN, px(13)], [0, 1], ...GRID_HEAD),
  chevron([px(1), PAN], [-1, 0], ...GRID_HEAD),
  chevron([px(13), PAN], [1, 0], ...GRID_HEAD),
].join('');

// ── zoom ─────────────────────────────────────────────────────────────────
// Handle departs the rim at exactly -45° so it meets the circle.
const zHandle = onCircle(9, 9, 5.4, -45);

// ── fit ──────────────────────────────────────────────────────────────────
const fitCorners = [
  `M3.2 7.2V4.4A1.2 1.2 0 0 1 4.4 3.2h2.8`,
  `M12.8 3.2h2.8A1.2 1.2 0 0 1 16.8 4.4v2.8`,
  `M16.8 12.8v2.8a1.2 1.2 0 0 1-1.2 1.2h-2.8`,
  `M7.2 16.8H4.4a1.2 1.2 0 0 1-1.2-1.2v-2.8`,
].join('');

// ── fit modes ────────────────────────────────────────────────────────────
// `fitViewToBounds`'s contain / fill / stretch: one frame (the viewport) and a
// circle (content whose aspect is known), placed the way each mode places it.
// The frame's lines sit on pixel centers at 16px for both 1x and 2x, and it is
// 1.25 wide — one device pixel at 1x. It runs past the 3..17 margin so `fill`
// can overflow it by two pixels; any less and the overflow is lost at 1x.
const FIT_FRAME_W = 1.25;
const [FX0, FX1, FY0, FY1] = [1.875, 18.125, 5.625, 14.375];
const fitRoomX = (FX1 - FX0) / 2 - FIT_FRAME_W / 2;
const fitRoomY = (FY1 - FY0) / 2 - FIT_FRAME_W / 2;
/** The radius whose 1.5 ink just meets the frame's ink, `room` from center. */
const meets = (room) => n(room - STROKE / 2);
const fitFrame = `<rect x="${FX0}" y="${FY0}" width="${n(FX1 - FX0)}" height="${n(FY1 - FY0)}" rx="1" stroke-width="${FIT_FRAME_W}"/>`;
const fitContent = (rx, ry) => `<ellipse cx="10" cy="10" rx="${rx}" ry="${ry}"/>`;

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

  // An X fills its box corner to corner where its neighbors do not, so it
  // stops short of their 3..17 margin to read as the same size beside them.
  close: `<path d="M4.5 4.5 15.5 15.5M15.5 4.5 4.5 15.5" stroke-width="1.75"/>`,

  export: `
    ${TRAY}
    <path d="M${px(7)} ${px(2)}V${px(9)}"/>
    <path d="${exportHead}"/>`,

  zoom: `
    <circle cx="9" cy="9" r="5.4"/>
    <path d="M${zHandle[0]} ${zHandle[1]} 16.9 16.9"/>
    <path d="M9 6.7v4.6M6.7 9h4.6"/>`,

  'zoom-out': `
    <circle cx="9" cy="9" r="5.4"/>
    <path d="M${zHandle[0]} ${zHandle[1]} 16.9 16.9"/>
    <path d="M6.7 9h4.6"/>`,

  fit: `
    <path d="${fitCorners}"/>
    <rect x="7.4" y="8.2" width="5.2" height="3.6" rx="0.8" stroke-width="1"/>`,

  // The largest circle the frame holds: it meets top and bottom, and the sides
  // stay empty.
  'fit-contain': fitFrame + fitContent(meets(fitRoomY), meets(fitRoomY)),

  // As wide as the frame, so it runs past the top and bottom.
  'fit-fill': fitFrame + fitContent(meets(fitRoomX), meets(fitRoomX)),

  // Squashed to the frame's proportions. Half a pixel shy of the frame on every
  // side: touching all four, it fuses into a thick border at 1x, and the shape
  // is what tells it from `fit-contain`, not where it touches.
  'fit-stretch': fitFrame + fitContent(n(meets(fitRoomX) - 0.625), n(meets(fitRoomY) - 0.625)),

  pan: `
    <path d="${panShafts}"/>
    <path d="${panHeads}"/>
    <circle cx="${PAN}" cy="${PAN}" r="${HUB}"/>`,
};

export const BASE_ORDER = ['clone', 'reset', 'close', 'export', 'zoom', 'zoom-out', 'fit', 'fit-contain', 'fit-fill', 'fit-stretch', 'pan'];
