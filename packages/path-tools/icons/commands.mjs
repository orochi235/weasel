// Path-structure commands: direction, start, corners, segment type and extremes.
import { px } from '../../icons/scripts/lib/base.mjs';

const n = (v) => Math.round(v * 1e4) / 1e4;
const anchor = (cx, cy, s = 2.5) =>
  `<rect x="${n(cx - s / 2)}" y="${n(cy - s / 2)}" width="${s}" height="${s}" fill="currentColor" stroke="none"/>`;
const dot = (cx, cy, r) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="currentColor" stroke="none"/>`;

// Resample: an arch drawn thin, so the anchors set along it at even steps stand off it. Each anchor is two
// pixels square, centered on the pixel corner nearest its point on the arch, so it fills whole pixels at 1x.
const ARCH = { cx: 10, cy: 13.75, r: 7.5 };
const onArch = (deg) => [ARCH.cx + ARCH.r * Math.cos((deg * Math.PI) / 180), ARCH.cy - ARCH.r * Math.sin((deg * Math.PI) / 180)];
const toCorner = (v) => Math.round(v / 1.25) * 1.25;
const resamplePath = `<path d="M${n(ARCH.cx - ARCH.r)} ${n(ARCH.cy)}A${ARCH.r} ${ARCH.r} 0 0 1 ${n(ARCH.cx + ARCH.r)} ${n(ARCH.cy)}" stroke-width="1"/>`
  + [180, 135, 90, 45, 0].map((deg) => anchor(...onArch(deg).map(toCorner))).join('');

// Convert a spiro to a path: spiro's round points at the ends, and at the top an anchor with its handles out.
const releaseSpiro = `<path d="M${px(2)} ${px(13)}C${px(2)} ${px(5)} ${px(13)} ${px(5)} ${px(13)} ${px(13)}" stroke-width="1"/>`
  + dot(px(2), px(13), 1.6) + dot(px(13), px(13), 1.6)
  + `<path d="M${px(3)} ${px(7)}H${px(12)}" stroke-width="1"/>` + anchor(px(7.5), px(7), 3)
  + dot(px(3), px(7), 1.1) + dot(px(12), px(7), 1.1);

// A blend's two ends, `blend`'s circle and box, joined by its spine: a path the steps follow, or the straight
// run they take once it is released.
const BLEND_ENDS = `<circle cx="${px(3)}" cy="${px(12)}" r="2.5"/><rect x="${px(10)}" y="${px(1)}" width="3.75" height="3.75" rx="0.6"/>`;
const setBlendSpine = BLEND_ENDS + `<path d="M${px(5)} ${px(12)}C11 ${px(12)} 9 ${px(4)} ${px(10)} ${px(4)}" stroke-width="1"/>`;
const releaseBlendSpine = BLEND_ENDS + `<path d="M6.25 13.75L${px(10)} 6.875" stroke-width="1" stroke-dasharray="1.3 1.3"/>`;

export const COMMANDS = {
  resamplePath,
  releaseSpiro,
  setBlendSpine,
  releaseBlendSpine,
  reversePath: `
    <path d="M4.5 6.875 H15.5 M15.5 13.125 H4.5"/>
    <path d="M6.5 5.175 L4.5 6.875 L6.5 8.575 M13.5 11.425 L15.5 13.125 L13.5 14.825"/>`,
  setPathStart: `
    <circle cx="10" cy="11.5" r="5.5" stroke-width="1.25"/>
    <rect x="8.5" y="4.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <path d="M13 2.6 L16 4.1 L13 5.6 Z" fill="currentColor" stroke="none"/>`,
  cornerRadius: `
    <path d="M4.375 17 V11.375 A7 7 0 0 1 11.375 4.375 H17"/>
    <path d="M4.375 8 V4.375 H8" stroke-width="1" stroke-dasharray="1.3 1.3"/>`,
  cornerShape: `
    <path d="M4 17 V10.5 L10.5 4 H17"/>
    <path d="M4 10.5 A6.5 6.5 0 0 0 10.5 4" stroke-width="1" stroke-dasharray="1.3 1.3"/>`,
  convertSegment: `
    <path d="M4 14 H16"/>
    <path d="M4 14 C4 6 16 6 16 14"/>
    <rect x="2.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="14.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  straightenSegment: `
    <path d="M4 14 H16"/>
    <path d="M4 14 C4 6 16 6 16 14" stroke-width="1" stroke-dasharray="1.4 1.4"/>
    <rect x="2.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="14.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  curveSegment: `
    <path d="M4 14 H16" stroke-width="1" stroke-dasharray="1.4 1.4"/>
    <path d="M4 14 C4 6 16 6 16 14"/>
    <rect x="2.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="14.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  extremeAnchors: `
    <path d="M3 16 C3 4.5 17 4.5 17 16"/>
    <path d="M3.5 7.4 H16.5" stroke-width="1"/>
    <rect x="1.5" y="14.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="15.5" y="14.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="8.5" y="5.9" width="3" height="3" fill="currentColor" stroke="none"/>`,
};
