import { chevron } from './base.mjs';

// A shaft the width of the frame's margin-to-margin, under an open head.
const HEAD = [3.6, 42];
const arrow = ([x0, y0], [x1, y1]) =>
  `<path d="M${x0} ${y0}L${x1} ${y1}"/><path d="${chevron([x1, y1], [x1 - x0, y1 - y0], ...HEAD)}"/>`;

export const ARROWS = {
  arrowLeft: arrow([16.2, 10], [3.8, 10]),
  arrowRight: arrow([3.8, 10], [16.2, 10]),
  arrowUp: arrow([10, 16.2], [10, 3.8]),
  arrowDown: arrow([10, 3.8], [10, 16.2]),
};

// Into and out of a box: three sides of it, and an arrow through the open one.
const SMALL = [2.9, 40];
export const HIERARCHY = {
  enter: `
    <path d="M9.4 3.8h5.2A1.6 1.6 0 0 1 16.2 5.4v9.2a1.6 1.6 0 0 1-1.6 1.6H9.4"/>
    <path d="M3.6 10h8"/>
    <path d="${chevron([11.6, 10], [1, 0], ...SMALL)}"/>`,
  leave: `
    <path d="M10.6 3.8H5.4A1.6 1.6 0 0 0 3.8 5.4v9.2a1.6 1.6 0 0 0 1.6 1.6h5.2"/>
    <path d="M8.4 10h8"/>
    <path d="${chevron([16.4, 10], [1, 0], ...SMALL)}"/>`,
};
