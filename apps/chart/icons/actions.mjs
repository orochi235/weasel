import { px } from '../../../packages/icons/scripts/lib/base.mjs';

// WeaselChart's own commands, on the 16px pixel-center grid.
const n = (v) => String(Math.round(v * 1e4) / 1e4);
const box = (l, t, r, b) => `<path d="M${n(px(l))} ${n(px(t))}H${n(px(r))}V${n(px(b))}H${n(px(l))}Z" stroke-linejoin="miter"/>`;
const path = (d) => `<path d="${d}" fill="none"/>`;
const H = (x0, x1, y) => `M${n(px(x0))} ${n(px(y))}H${n(px(x1))}`;
const V = (x, y0, y1) => `M${n(px(x))} ${n(px(y0))}V${n(px(y1))}`;

export const ACTIONS = {
  // Two shapes of different heights, centered on the guide that runs through both. Its dashes are whole pixels at 1x.
  snapShapes: box(1, 2, 6, 12) + box(9, 5, 14, 9)
    + `<path d="M0 ${n(px(7))}H20" stroke-dasharray="1.25 1.25" stroke-linecap="butt"/>`,
  // Three shapes, their two gaps measured alike beneath them.
  snapGaps: box(0, 1, 3, 10) + box(6, 1, 9, 10) + box(12, 1, 15, 10)
    + path(H(3, 6, 13) + V(3, 12, 14) + V(6, 12, 14))
    + path(H(9, 12, 13) + V(9, 12, 14) + V(12, 12, 14)),
  // A tree laid out: a root over two children, joined by a bus.
  autoLayout: box(5, 0, 9, 3) + box(0, 11, 4, 15) + box(10, 11, 14, 15)
    + path(V(7, 3, 7) + H(2, 12, 7) + V(2, 7, 11) + V(12, 7, 11)),
};
