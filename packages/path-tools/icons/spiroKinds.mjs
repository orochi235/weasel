// A spiro point's kind, as `setSpiroKind` sets it: the curve on either side of a round point, which is how
// a spiro marks its points. Drawn on 16px 1x pixel centers at a stroke one pixel wide.
import { px } from '../../icons/scripts/lib/base.mjs';

const W = 1.25;
const P = (c, r) => `${px(c)} ${px(r)}`;
const point = (c, r) => `<circle cx="${px(c)}" cy="${px(r)}" r="1.875" fill="currentColor" stroke="none"/>`;
const curve = (d) => `<path d="${d}" stroke-width="${W}"/>`;

export const SPIRO_KINDS = {
  // Level through the point, so the curve runs on with no kink.
  spiroSmooth: curve(`M${P(1, 12)}C${P(5, 12)} ${P(4, 7)} ${P(7, 7)}C${P(10, 7)} ${P(9, 2)} ${P(13, 2)}`) + point(7, 7),
  // The same curve, its point a ring round a dot: smoother still.
  spiroG4:
    curve(`M${P(1, 12)}C${P(5, 12)} ${P(4, 7)} ${P(5, 7)}M${P(9, 7)}C${P(10, 7)} ${P(9, 2)} ${P(13, 2)}`) +
    `<circle cx="${px(7)}" cy="${px(7)}" r="2.5" stroke-width="${W}"/>` +
    `<circle cx="${px(7)}" cy="${px(7)}" r="0.625" fill="currentColor" stroke="none"/>`,
  // At 45 degrees, which lands on the pixel diagonal.
  spiroCorner: curve(`M${P(1, 12)}L${P(7, 6)}L${P(13, 12)}`) + point(7, 6),
  // A straight run into the point, and a curve out of it along the same line.
  spiroLeft: curve(`M${P(1, 11)}H${px(7)}C${P(11, 11)} ${P(13, 8)} ${P(13, 3)}`) + point(7, 11),
  spiroRight: curve(`M${P(1, 3)}C${P(1, 8)} ${P(3, 11)} ${P(7, 11)}H${px(13)}`) + point(7, 11),
};
