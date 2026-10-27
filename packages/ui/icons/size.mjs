import { chevron } from '../../icons/scripts/lib/base.mjs';

// Size: a bar, and arrows along the axis it grows on. `at` places a point given
// along that axis and across it, so the tall glyphs and the wide ones are one drawing.
//
// Every coordinate is a pixel center at 16px 1x: `px(k)` is the center of pixel k, an odd multiple of
// 0.625. So the shaft runs down pixel 7, and each head's barbs end two whole pixels back from its tip and two
// either side of it, at 45 degrees; at 2.6 long and 40 degrees the heads closed up into dots at 1x.
const px = (k) => 0.625 + 1.25 * k;
const SHAFT = px(7);
const HEAD = [2.5 * Math.SQRT2, 45];
const tall = (t, c) => [c, t];
const wide = (t, c) => [t, c];

const line = (at, t0, t1, c0 = SHAFT, c1 = SHAFT) => `M${at(t0, c0).join(' ')}L${at(t1, c1).join(' ')}`;
const head = (at, tip, toward) => {
  const [x, y] = at(px(tip), SHAFT);
  const [dx, dy] = at(toward, 0);
  return chevron([x, y], [dx, dy], ...HEAD);
};
const rule = (at, k) => `<path d="${line(at, px(k), px(k), px(3), px(11))}"/>`;
const arrow = (at, from, tip) =>
  `<path d="${line(at, px(from), px(tip))}"/><path d="${head(at, tip, Math.sign(tip - from))}"/>`;

// Out from the bar, or in onto it. Pixels 1 to 13, about the bar on pixel 7.
const grow = (at) => rule(at, 7) + arrow(at, 5, 2) + arrow(at, 9, 12);
const shrink = (at) => rule(at, 7) + arrow(at, 1, 5) + arrow(at, 13, 9);
// As far as it goes: out to a stop at each end, or in onto two stops with no room left between them.
const most = (at) =>
  rule(at, 1) + rule(at, 13) + `<path d="${line(at, px(3), px(11))}"/><path d="${head(at, 3, -1)}"/><path d="${head(at, 11, 1)}"/>`;
const least = (at) => rule(at, 6) + rule(at, 8) + arrow(at, 1, 4) + arrow(at, 13, 10);

export const SIZE = {
  taller: grow(tall),
  shorter: shrink(tall),
  wider: grow(wide),
  narrower: shrink(wide),
  tallest: most(tall),
  shortest: least(tall),
};
