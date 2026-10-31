// The state, requirement, C4, block, and kanban stencils, on grid.mjs's grid.

import { P, at, n, rect, roundRect } from './grid.mjs';

const circle = (cx, cy, r) => `M${P(cx - r, cy)}A${n(r)} ${n(r)} 0 1 1 ${P(cx + r, cy)}A${n(r)} ${n(r)} 0 1 1 ${P(cx - r, cy)}Z`;
const solid = (d) => `<path d="${d}" fill="currentColor" stroke="none"/>`;

/** A queue: a cylinder lying down, its right end the face that shows. */
const QUEUE = { l: at(7), r: at(25), t: at(9), b: at(23), rx: 2.5 };
const ry = (QUEUE.b - QUEUE.t) / 2;
const queueBody = `M${P(QUEUE.l, QUEUE.t)}H${n(QUEUE.r)}A${n(QUEUE.rx)} ${n(ry)} 0 0 1 ${P(QUEUE.r, QUEUE.b)}`
  + `H${n(QUEUE.l)}A${n(QUEUE.rx)} ${n(ry)} 0 0 1 ${P(QUEUE.l, QUEUE.t)}Z`;
const queueRim = `M${P(QUEUE.r, QUEUE.t)}A${n(QUEUE.rx)} ${n(ry)} 0 0 0 ${P(QUEUE.r, QUEUE.b)}`;

const CARD = roundRect(at(5), at(7), at(27), at(25), at(3));
const REQ = rect(at(7), at(3), at(25), at(29));

export const STATE = {
  stateStart: solid(circle(10, 10, 4.375)),
  stateEnd: `<path d="${circle(10, 10, 7.5)}"/>${solid(circle(10, 10, 3.75))}`,
  stateFork: solid(rect(at(3), 8.75, at(29), 11.25)),
};

export const REQUIREMENT = {
  requirement: { d: `${REQ}M${P(at(7), at(11))}H${n(at(25))}M7.5 12.5 9.375 14.375 12.5 10.625`, fill: REQ, join: 'miter' },
};

export const C4 = {
  c4Container: { d: `${CARD}M${P(at(11), at(13))}H${n(at(21))}M${P(at(13), at(19))}H${n(at(19))}`, fill: CARD },
  queue: `<path d="${queueBody}"/><path d="${queueRim}"/>`,
};

/** Four blocks in a grid, as a block diagram lays them out. */
const BLOCKS = [rect(at(3), at(3), at(13), at(13)), rect(at(19), at(3), at(29), at(13)), rect(at(3), at(19), at(13), at(29)), rect(at(19), at(19), at(29), at(29))].join('');

export const BLOCK = {
  blocks: { d: BLOCKS, fill: BLOCKS, join: 'miter' },
};

export const KANBAN = {
  kanbanCard: { d: `${CARD}M${P(at(9), at(13))}H${n(at(23))}M${P(at(9), at(19))}H${n(at(19))}`, fill: CARD },
};
