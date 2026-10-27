import { chevron, GRID_HEAD, px } from '../../icons/scripts/lib/base.mjs';

// Every point is a pixel center at 16px 1x (`px`). A shaft across pixels 2 to 12, down pixel 7, under an open head.
const arrow = ([x0, y0], [x1, y1]) =>
  `<path d="M${x0} ${y0}L${x1} ${y1}"/><path d="${chevron([x1, y1], [x1 - x0, y1 - y0], ...GRID_HEAD)}"/>`;
const across = (from, tip, at = 7) => arrow([px(from), px(at)], [px(tip), px(at)]);
const down = (from, tip) => arrow([px(7), px(from)], [px(7), px(tip)]);

export const ARROWS = {
  arrowLeft: across(12, 2),
  arrowRight: across(2, 12),
  arrowUp: down(12, 2),
  arrowDown: down(2, 12),
};

// Into and out of a box: three sides of it, and an arrow through the open one.
// The box spans pixels 2 to 12, and the arrow runs two pixels past its open side.
export const HIERARCHY = {
  enter: `
    <path d="M9.375 3.125h4.65a1.6 1.6 0 0 1 1.6 1.6v9.3a1.6 1.6 0 0 1-1.6 1.6H9.375"/>
    ${across(2, 9)}`,
  leave: `
    <path d="M9.375 3.125h-4.65a1.6 1.6 0 0 0-1.6 1.6v9.3a1.6 1.6 0 0 0 1.6 1.6h4.65"/>
    ${across(5, 12)}`,
};
