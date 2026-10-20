// The container stencils: a titled box, and pools of rows and of columns. All
// three share one frame, so they read as a family beside the shape set's
// Process and Decision.
//
// Every coordinate is GRID/2 past a multiple of 2*GRID: a 16px glyph's pixel
// center at 1x and a pixel edge at 2x, so each 1.5 stroke lands on whole pixels.

import { STROKE } from '../../icons/scripts/lib/base.mjs';

const GRID = 0.625;
const at = (k) => k * GRID;

/** The frame: about as wide as the shape set's rectangle, taller to hold a band and two lanes. */
const LEFT = at(5);
const RIGHT = at(27);
const TOP = at(7);
const BOTTOM = at(25);
/** A header band's depth, across the top or down the left. */
const BAND = at(6);

if (BAND - STROKE < 2) throw new Error(`containers: a ${BAND} band leaves too little gap inside its strokes`);

const n = (v) => String(Math.round(v * 1e4) / 1e4);
const P = (x, y) => `${n(x)} ${n(y)}`;
const FRAME = `M${P(LEFT, TOP)}H${n(RIGHT)}V${n(BOTTOM)}H${n(LEFT)}Z`;
const line = (x0, y0, x1, y1) => `M${P(x0, y0)}L${P(x1, y1)}`;

const titleRule = line(LEFT, TOP + BAND, RIGHT, TOP + BAND);
// A centered frame's midline falls between two 1x pixels, so the lane divider
// sits one GRID step past it: crisp at 1x and 2x, the second lane one pixel short.
const SPLIT = GRID;
const midX = (LEFT + RIGHT) / 2 + SPLIT;
const midY = (TOP + BOTTOM) / 2 + SPLIT;

const glyph = (inner) => ({ d: FRAME + inner, fill: FRAME, join: 'miter' });

export const CONTAINERS = {
  container: glyph(titleRule),
  'pool-rows': glyph(line(LEFT + BAND, TOP, LEFT + BAND, BOTTOM) + line(LEFT + BAND, midY, RIGHT, midY)),
  'pool-columns': glyph(titleRule + line(midX, TOP + BAND, midX, BOTTOM)),
};
