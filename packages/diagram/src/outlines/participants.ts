/**
 * The figures a sequence's participants wear besides the actor and the
 * database cylinder: UML's boundary, control, and entity, each over a label
 * strip as the actor is; a stack of collections; and a queue, a cylinder on
 * its side.
 */
import { PathBuilder } from '@weasel-js/core/math';
import { figureOver } from './figures';
import { KAPPA } from './flowchart';
import { outlineFromD } from './fromD';
import type { Bounds, OutlineDef } from './types';

/** The share of the height a figure takes over its label, as the actor's. */
const SHARE = 0.75;

/** An ellipse as two arcs, in path data. */
const ring = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${cx + rx} ${cy}A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}Z`;

/** A circle on a short stem from a wall at its left. Drawn 1.5 wide, so its ring's x radius is its y radius over 1.5. */
const boundary = figureOver(outlineFromD(`${ring(0.7, 0.5, 0.4 / 1.5, 0.4)}M0.04 0.1V0.9M0.04 0.5H${0.7 - 0.4 / 1.5}`), 1.5, SHARE);

/** A circle with an arrowhead on its rim, turning it. */
const control = figureOver(outlineFromD(ring(0.5, 0.55, 0.42, 0.42), { detail: 'M0.6 0.02L0.46 0.13L0.6 0.24' }), 1, SHARE);

/** A circle on a rule. */
const entity = figureOver(outlineFromD(`${ring(0.5, 0.45, 0.42, 0.42)}M0.08 0.97H0.92`), 1, SHARE);

/** How far the back box of a stack stands off the front one. */
const offsetOf = (w: number, h: number): number => Math.min(6, w / 8, h / 8);

const collections: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => {
    const o = offsetOf(w, h);
    return new PathBuilder()
      .moveTo(x + o, y).lineTo(x + w, y).lineTo(x + w, y + h - o).lineTo(x + w - o, y + h - o).lineTo(x + w - o, y + h)
      .lineTo(x, y + h).lineTo(x, y + o).lineTo(x + o, y + o).close().build();
  },
  detail: ({ x, y, width: w, height: h }) => {
    const o = offsetOf(w, h);
    return new PathBuilder().moveTo(x + o, y + o).lineTo(x + w - o, y + o).lineTo(x + w - o, y + h - o).build();
  },
  content: ({ x, y, width: w, height: h }) => {
    const o = offsetOf(w, h);
    return { x, y: y + o, width: w - o, height: h - o };
  },
  boxForContent: (c) => ({ width: c.width + 6, height: c.height + 6 }),
};

/** A queue's cap depth: a fraction of its width, flattened for a short box. */
const capOf = (w: number, h: number): number => Math.min(w * 0.12, h * 0.3);

const queue: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => {
    const r = capOf(w, h);
    const cy = y + h / 2;
    const ry = h / 2;
    return new PathBuilder()
      .moveTo(x + r, y).lineTo(x + w - r, y)
      .curveTo(x + w - r + r * KAPPA, y, x + w, cy - ry * KAPPA, x + w, cy)
      .curveTo(x + w, cy + ry * KAPPA, x + w - r + r * KAPPA, y + h, x + w - r, y + h)
      .lineTo(x + r, y + h)
      .curveTo(x + r - r * KAPPA, y + h, x, cy + ry * KAPPA, x, cy)
      .curveTo(x, cy - ry * KAPPA, x + r - r * KAPPA, y, x + r, y)
      .close().build();
  },
  detail: ({ x, y, width: w, height: h }: Bounds) => {
    const r = capOf(w, h);
    const cy = y + h / 2;
    const ry = h / 2;
    const rim = x + w - r;
    return new PathBuilder()
      .moveTo(rim, y)
      .curveTo(rim - r * KAPPA, y, rim - r, cy - ry * KAPPA, rim - r, cy)
      .curveTo(rim - r, cy + ry * KAPPA, rim - r * KAPPA, y + h, rim, y + h)
      .build();
  },
  content: ({ x, y, width: w, height: h }) => {
    const r = capOf(w, h);
    return { x: x + r, y, width: Math.max(w - r * 3, 0), height: h };
  },
  boxForContent: (c) => ({ width: c.width / 0.64, height: c.height }),
};

export const PARTICIPANT_OUTLINES = { boundary, control, entity, collections, queue };
