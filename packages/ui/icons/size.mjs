import { chevron } from '../../icons/scripts/lib/base.mjs';

// Size: a bar, and arrows along the axis it grows on. `at` places a point given
// along that axis and across it, so the tall glyphs and the wide ones are one drawing.
const HEAD = [2.6, 40];
const tall = (t, c) => [c, t];
const wide = (t, c) => [t, c];

const line = (at, t0, t1, c0 = 10, c1 = 10) => `M${at(t0, c0).join(' ')}L${at(t1, c1).join(' ')}`;
const head = (at, tip, toward) => {
  const [x, y] = at(tip, 10);
  const [dx, dy] = at(toward, 0);
  return chevron([x, y], [dx, dy], ...HEAD);
};
const rule = (at, t) => `<path d="${line(at, t, t, 5.2, 14.8)}"/>`;
const arrow = (at, from, tip) =>
  `<path d="${line(at, from, tip)}"/><path d="${head(at, tip, Math.sign(tip - from))}"/>`;

// Out from the bar, or in onto it.
const grow = (at) => rule(at, 10) + arrow(at, 7.2, 3.4) + arrow(at, 12.8, 16.6);
const shrink = (at) => rule(at, 10) + arrow(at, 3.4, 7.4) + arrow(at, 16.6, 12.6);
// As far as it goes: out to a stop at each end, or in onto two stops with no room left between them.
const most = (at) =>
  rule(at, 3.4) + rule(at, 16.6) + `<path d="${line(at, 6, 14)}"/><path d="${head(at, 6, -1)}"/><path d="${head(at, 14, 1)}"/>`;
const least = (at) => rule(at, 8.5) + rule(at, 11.5) + arrow(at, 2.8, 5.8) + arrow(at, 17.2, 14.2);

export const SIZE = {
  taller: grow(tall),
  shorter: shrink(tall),
  wider: grow(wide),
  narrower: shrink(wide),
  tallest: most(tall),
  shortest: least(tall),
};
