import { chevron, px } from '../../icons/scripts/lib/base.mjs';

const HEAD = [2.5 * Math.SQRT2, 45];

// What path edit can draw over the open path, for the toggles that show it.
export const OVERLAYS = {
  // A path with heads along it, the marks the toggle shows.
  pathDirection: `<path d="M${px(1)} ${px(7)}H${px(14)}"/>`
    + `<path d="${chevron([px(6), px(7)], [1, 0], ...HEAD)}"/><path d="${chevron([px(12), px(7)], [1, 0], ...HEAD)}"/>`,
};
