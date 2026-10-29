// Path tools and the effects they make.
import { px } from '../../icons/scripts/lib/base.mjs';
import { rounded } from './rounded.mjs';

const SPIRO_TOOL = [[1, 12], [4, 12], [10, 6], [13, 6]];
// One of envelope's rows, from column 1 to 13 with its ends on `row`, bowed up two pixels. `back` runs it from
// 13 to 1 and joins it to the path so far.
const bow = (row, back = false) => {
  const pts = [[1, row], [3, row - 2], [11, row - 2], [13, row]];
  const d = rounded(back ? pts.reverse() : pts, 2.5);
  return back ? `L${d.slice(1)}` : d;
};
const P = (c, r) => `${px(c)} ${px(r)}`;
// Straight segments through pixel centers, every corner on one.
const poly = (pts) => pts.map(([c, r], i) => `${i ? 'L' : 'M'}${P(c, r)}`).join('');
const dot = (c, r, rad = 1.875) => `<circle cx="${px(c)}" cy="${px(r)}" r="${rad}" fill="currentColor" stroke="none"/>`;
// A handle three pixels square on pixel (c, r).
const handle = (c, r) => `<rect x="${px(c) - 1.875}" y="${px(r) - 1.875}" width="3.75" height="3.75" fill="currentColor" stroke="none"/>`;
export const TOOLS = {
  smudgeBrush: `
    <path d="M2 15.5 H5 C9 15.5 9.5 7 14 7"/>
    <circle cx="14" cy="7" r="3.75" stroke-width="1"/>
    <path d="M14 7 C15.5 9.5 16.5 15.5 18 15.5"/>`,
  // A quad pulled out of square by its corner handles, every corner on a pixel center at a one-pixel stroke.
  // A square with one corner pushed in by its handle. The two edges it moves run two pixels along for each one
  // across, the steepest slope short of the diagonal that still meets a pixel center every other step.
  distort: `
    <path d="M${P(1, 1)}H${px(13)}V${px(13)}L${P(5, 9)}Z" stroke-width="1.25"/>
    ${handle(1, 1)}${handle(13, 1)}${handle(13, 13)}${handle(5, 9)}`,
  // A two-by-two mesh whose rows bow upward, each bow a level run between two pixel diagonals and its columns on
  // pixels 1, 7 and 13, so every line stays crisp at 1x.
  envelope: `
    <path d="M${P(1, 14)}V${px(4)}L${bow(4).slice(1)}V${px(14)}${bow(14, true)}" stroke-width="1.25"/>
    <path d="M${P(7, 2)}V${px(12)}${bow(9)}" stroke-width="1.25"/>
    ${dot(1, 4)}${dot(13, 4)}${dot(13, 14)}${dot(1, 14)}`,
  puppetWarp: `
    <path d="${rounded([[0, 10.5], [0, 8], [4, 8], [11, 1], [15, 1], [15, 6], [11, 6], [4, 13], [0, 13], [0, 10.5]], 1.25)}Z" stroke-width="1.25"/>
    ${dot(2.5, 10.5, 1.5)}${dot(12.5, 3.5, 1.5)}`,
  blend: `
    <circle cx="3.125" cy="9.375" r="2.5" stroke-width="1.25"/>
    <rect x="8.125" y="5.625" width="3.75" height="7.5" rx="1.25" stroke-width="1.25"/>
    <rect x="14.375" y="4.375" width="3.75" height="10" rx="0.5" stroke-width="1.25"/>`,
  // Each stripe runs along the band's normal from one edge's line to the other's and stops there: a cap past
  // either line shows outside the band.
  bendAlong: `
    <path d="M3 14 Q10 0 17 14 L14.5 15 Q10 5 5.5 15 Z"/>
    <path d="M10 7 V10 M6.5 8.75 L8.39 10.64 M13.5 8.75 L11.61 10.64" stroke-width="1" stroke-linecap="butt"/>`,
  repeatAlong: `
    <path d="M2.9 14.2 L3.6 12.9 M6.4 10.1 L8.2 8.8 M11.8 8.8 L13.6 10.1 M16.4 12.9 L17.1 14.2" stroke-width="1"/>
    <circle cx="4.75" cy="11.43" r="1.9" stroke-width="1.25"/>
    <circle cx="10" cy="8" r="1.9" stroke-width="1.25"/>
    <circle cx="15.25" cy="11.43" r="1.9" stroke-width="1.25"/>`,
  // Set 0.625 left of center so the stem and bar fill whole pixels at 16px.
  textAlong: `
    <path d="M1.875 16 Q9.375 7.75 16.875 16"/>
    <path d="M5.375 3.125 H13.375 M9.375 3.125 V8.25"/>`,
  // A square with each corner and each edge's middle knocked out of place.
  roughen: `
    <path d="${poly([[2, 2], [7, 3], [12, 1], [13, 7], [14, 13], [8, 12], [2, 14], [3, 8]])}Z" stroke-width="1.25"/>`,
  // Teeth at 45 degrees, three pixels high.
  zigzag: `
    <path d="${poly([[0, 9], [3, 6], [6, 9], [9, 6], [12, 9], [15, 6]])}" stroke-width="1.25"/>`,
  // A square puckered into four spikes.
  puckerBloat: `
    <path d="M${P(7, 1)}C${P(7, 4.7)} ${P(9.3, 7)} ${P(13, 7)}C${P(9.3, 7)} ${P(7, 9.3)} ${P(7, 13)}C${P(7, 9.3)} ${P(4.7, 7)} ${P(1, 7)}C${P(4.7, 7)} ${P(7, 4.7)} ${P(7, 1)}Z" stroke-width="1.25"/>`,
  expand: `
    <circle cx="10" cy="10" r="6" stroke-width="1.25" stroke-dasharray="2 1.7"/>
    <rect x="8.5" y="2.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="14.5" y="8.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="8.5" y="14.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="2.5" y="8.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  balanceHandles: `
    <path d="M3.5 16 C5 6 15 6 16.5 16"/>
    <path d="M3.5 16 L5 6 M16.5 16 L15 6 M5 6 H8.25 M11.75 6 H15" stroke-width="1"/>
    <circle cx="5" cy="6" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="6" r="1.75" stroke-width="1.25"/>
    <path d="M8.8 12 L10 13.2 L11.2 12 M10 9.6 V13" stroke-width="1"/>`,
  equalizeHandles: `
    <path d="M3.5 16 C5 6 15 6 16.5 16"/>
    <path d="M3.5 16 L5 6 M16.5 16 L15 6 M5 6 H8.25 M11.75 6 H15" stroke-width="1"/>
    <circle cx="5" cy="6" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="6" r="1.75" stroke-width="1.25"/>
    <path d="M8.5 10.8 H11.5 M8.5 12.8 H11.5" stroke-width="1"/>`,
  lengthen: `
    <path d="M2.5 17 C6.5 17 8.5 15.5 11 13"/>
    <path d="M13 11 L16.5 7.5" stroke-dasharray="1 3"/>
    <rect x="9.5" y="11.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  trim: `
    <path d="M6.875 3 V17 M13.125 3 V17" stroke-width="1.25"/>
    <path d="M2.5 10.625 H6.875 M13.125 10.625 H17.5"/>
    <path d="M8.6 10.625 H11.4" stroke-width="1" stroke-dasharray="1.2 1.2"/>`,
  extend: `
    <path d="M16.875 3 V17" stroke-width="1.25"/>
    <path d="M2.5 10.625 H8"/>
    <rect x="6.5" y="9.125" width="3" height="3" fill="currentColor" stroke="none"/>
    <path d="M10.5 10.625 H15" stroke-width="1" stroke-dasharray="1.4 1.3"/>`,
  girth: `
    <path d="M2.5 10 C6 4.6 14 4.6 17.5 10 C14 15.4 6 15.4 2.5 10 Z"/>
    <path d="M10 6.6 V13.4" stroke-width="1"/>
    <circle cx="10" cy="6.6" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="13.4" r="1.4" fill="currentColor" stroke="none"/>`,
  // An S that runs level, up the pixel diagonal and level again, with round points at its ends and its middle.
  spiro: `<path d="${rounded(SPIRO_TOOL, 2.5)}" stroke-width="1.25"/>${dot(1, 12)}${dot(7, 9)}${dot(13, 6)}`,
};
