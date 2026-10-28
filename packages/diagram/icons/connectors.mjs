// The connector commands: one glyph per router, each joining two solid end boxes, and line jumps.

import { P, at, line, rect } from './grid.mjs';

const pt = (x, y) => P(at(x), at(y));
const box = (l, t, r, b) => rect(at(l), at(t), at(r), at(b));

const solid = (d) => `<path d="${d}" fill="currentColor" stroke-linejoin="miter"/>`;
const stroke = (d) => `<path d="${d}" fill="none" stroke-linejoin="miter"/>`;

/** The end boxes the three plain routers join: lower left to upper right. */
const ENDS = solid(box(3, 21, 11, 29) + box(21, 3, 29, 11));

export const CONNECTORS = {
  routerStraight: ENDS + stroke(line(at(11), at(21), at(21), at(11))),
  routerOrthogonal: ENDS + stroke(`M${pt(11, 25)}H${at(25)}V${at(11)}`),
  routerCurved: ENDS + stroke(`M${pt(11, 25)}C${pt(19, 25)} ${pt(25, 19)} ${pt(25, 11)}`),
  // Side by side, routed over the outlined shape between them.
  routerAvoid: solid(box(1, 21, 9, 29) + box(23, 21, 31, 29)) + stroke(box(13, 13, 19, 29))
    + stroke(`M${pt(5, 21)}V${at(5)}H${at(27)}V${at(21)}`),
  // The crossed line runs through; the jumping one arcs over it.
  lineJumps: stroke(line(at(17), at(5), at(17), at(29)))
    + stroke(`M${pt(3, 21)}H${at(11)}A${at(6)} ${at(6)} 0 0 1 ${pt(23, 21)}H${at(29)}`),
};
