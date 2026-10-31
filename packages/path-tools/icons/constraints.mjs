// Path constraints: two segments held at a right angle, its foot marked, and the same right angle let go, the
// vertical it held dashed where it was.
import { px } from '../../icons/scripts/lib/base.mjs';

const n = (v) => Math.round(v * 1e4) / 1e4;
// Three pixels square on a pixel center, so it fills whole pixels at 1x.
const anchor = ([cx, cy], s = 3.75) =>
  `<rect x="${n(cx - s / 2)}" y="${n(cy - s / 2)}" width="${s}" height="${s}" fill="currentColor" stroke="none"/>`;

const CORNER = [px(3), px(12)];
const RIGHT = [px(13), px(12)];
const TOP = [px(3), px(2)];
const LEANING = [px(11), px(4)];

export const CONSTRAINTS = {
  constrainAnchors: `<path d="M${TOP[0]} ${TOP[1]}V${CORNER[1]}H${RIGHT[0]}"/>`
    + `<path d="M${CORNER[0]} ${px(8)}H${px(7)}V${CORNER[1]}" stroke-width="1"/>`
    + anchor(TOP) + anchor(CORNER) + anchor(RIGHT),
  // The dash runs from a pixel edge in whole pixels, two on and one off, so each dash is crisp at 1x.
  unconstrainAnchors: `<path d="M${CORNER[0]} 2.5V13.75" stroke-width="1" stroke-linecap="butt" stroke-dasharray="2.5 1.25"/>`
    + `<path d="M${LEANING[0]} ${LEANING[1]}L${CORNER[0]} ${CORNER[1]}H${RIGHT[0]}"/>`
    + anchor(LEANING) + anchor(CORNER) + anchor(RIGHT),
};
