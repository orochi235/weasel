// Anchor selection along a path: which anchors a command leaves selected. Every edge sits on a 16px 1x
// pixel center or edge, at a stroke one pixel wide: an anchor is three pixels square, filled when selected
// and open, with a one-pixel hole, when not, and the path shows only between anchors.
import { chevron, GRID_HEAD, px } from '../../icons/scripts/lib/base.mjs';

const W = 1.25;
const n = (v) => Math.round(v * 1e4) / 1e4;
const on = (c, r) => `<rect x="${n(px(c) - 1.875)}" y="${n(px(r) - 1.875)}" width="3.75" height="3.75" fill="currentColor" stroke="none"/>`;
const off = (c, r) => `<rect x="${n(px(c - 1))}" y="${n(px(r - 1))}" width="2.5" height="2.5" stroke-width="${W}"/>`;
const anchor = (c, r, selected) => (selected ? on(c, r) : off(c, r));

/** Anchors at columns `cols` along row `r`, joined by the path where none covers it. */
function row(r, cols, selected) {
  const runs = cols.slice(1).map((c, i) => `M${px(cols[i] + 2)} ${px(r)}H${px(c - 2)}`).join('');
  return `<path d="${runs}" stroke-width="${W}"/>` + cols.map((c, i) => anchor(c, r, selected[i])).join('');
}

const FOUR = [1, 5, 9, 13];
const THREE = [2, 7, 12];
const arrow = (from, tip) =>
  `<path d="M${px(from)} ${px(3)}H${px(tip)}" stroke-width="${W}"/>` +
  `<path d="${chevron([px(tip), px(3)], [Math.sign(tip - from), 0], ...GRID_HEAD)}" stroke-width="${W}"/>`;

// The two middle anchors selected and the outer two not, under arrows that push the selection out or in.
const middle = row(11, FOUR, [false, true, true, false]);

// A path with square corners on its left and a round side on its right, whose rightmost point is smooth.
const dShape = (corners, smooth) =>
  `<path d="M${px(2)} ${px(2)}H${px(7)}A5 5 0 0 1 ${px(7)} ${px(12)}H${px(2)}Z" stroke-width="${W}"/>` +
  anchor(2, 2, corners) + anchor(2, 12, corners) + anchor(12, 7, smooth);

export const ANCHOR_SELECT = {
  growAnchorSelection: middle + arrow(5, 1) + arrow(9, 13),
  shrinkAnchorSelection: middle + arrow(0, 4) + arrow(14, 10),
  selectEveryNthAnchor: row(7, FOUR, [true, false, true, false]),
  selectCornerAnchors: dShape(true, false),
  selectSmoothAnchors: dShape(false, true),
  invertAnchorSelection: row(3, THREE, [true, false, true]) + row(11, THREE, [false, true, false]),
};
