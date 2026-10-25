/**
 * The flowchart vocabulary: a decision is a diamond, an I/O step a
 * parallelogram, a terminator a stadium, a demultiplexer a trapezoid, a
 * preparation step a hexagon, a connector an ellipse, and `rect` for
 * everything else.
 */
import { PathBuilder, polygonFromPoints, rectPath, type Path } from '@weasel-js/core/math';
import { ellipsePath } from '@weasel-js/geom';
import type { OutlineDef } from './types';

/** How far a parallelogram's top edge leans past its bottom one, as a
 *  fraction of the box's width. The flowchart convention. */
const LEAN = 0.2;
/** How far a hexagon's points reach past its flat top and bottom, as a
 *  fraction of the box's width. */
const POINT = 0.2;

/** Cubic approximation of a quarter circle. A stadium's ends are two of these
 *  each, which is the same construction `ellipsePath` uses. */
export const KAPPA = 0.5522847498307936;

const rect: OutlineDef = {
  path: ({ x, y, width, height }) => rectPath(x, y, width, height),
};

const diamond: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => polygonFromPoints([
    { x: x + w / 2, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w / 2, y: y + h },
    { x, y: y + h / 2 },
  ]),
  // Half the width and half the height, centered: the inscribed rect.
  content: ({ x, y, width: w, height: h }) => ({ x: x + w / 4, y: y + h / 4, width: w / 2, height: h / 2 }),
  boxForContent: (c) => ({ width: c.width * 2, height: c.height * 2 }),
};

// The lean is clamped so a narrow box cannot fold through itself.
const leanOf = (w: number): number => Math.min(w * LEAN, w / 2);

const parallelogram: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => {
    const lean = leanOf(w);
    return polygonFromPoints([
      { x: x + lean, y },
      { x: x + w, y },
      { x: x + w - lean, y: y + h },
      { x, y: y + h },
    ]);
  },
  content: ({ x, y, width: w, height: h }) => {
    const lean = leanOf(w);
    return { x: x + lean, y, width: Math.max(w - lean * 2, 0), height: h };
  },
  boxForContent: (c) => ({ width: c.width / (1 - LEAN * 2), height: c.height }),
};

const trapezoid: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => polygonFromPoints([
    { x, y: y + h / 4 },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + (h * 3) / 4 },
  ]),
  content: ({ x, y, width: w, height: h }) => ({ x, y: y + h / 4, width: w, height: h / 2 }),
  boxForContent: (c) => ({ width: c.width, height: c.height * 2 }),
};

const hexagon: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => polygonFromPoints([
    { x, y: y + h / 2 },
    { x: x + w * POINT, y },
    { x: x + w * (1 - POINT), y },
    { x: x + w, y: y + h / 2 },
    { x: x + w * (1 - POINT), y: y + h },
    { x: x + w * POINT, y: y + h },
  ]),
  content: ({ x, y, width: w, height: h }) => ({ x: x + w * POINT, y, width: w * (1 - POINT * 2), height: h }),
  boxForContent: (c) => ({ width: c.width / (1 - POINT * 2), height: c.height }),
};

const ellipse: OutlineDef = {
  path: ellipsePath,
  // The inscribed rect of an ellipse is its box over root two, centered.
  content: ({ x, y, width: w, height: h }) => {
    const cw = w / Math.SQRT2;
    const ch = h / Math.SQRT2;
    return { x: x + (w - cw) / 2, y: y + (h - ch) / 2, width: cw, height: ch };
  },
  boxForContent: (c) => ({ width: c.width * Math.SQRT2, height: c.height * Math.SQRT2 }),
};

/** A stadium reports the flat span between its rounded ends, giving up a
 *  little height near them. Its inverse assumes the wide orientation and adds
 *  one height's worth of end caps. */
const stadium: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => stadiumPath(x, y, w, h),
  content: ({ x, y, width: w, height: h }) => {
    const r = Math.min(w, h) / 2;
    return w >= h
      ? { x: x + r, y, width: Math.max(w - r * 2, 0), height: h }
      : { x, y: y + r, width: w, height: Math.max(h - r * 2, 0) };
  },
  boxForContent: (c) => ({ width: c.width + c.height, height: c.height }),
};

/** A rect with semicircular ends — the Minkowski sum of a segment and a disc,
 *  which puts the flat edges along the box's *longer* axis. A tall box is a
 *  pill standing up, not an ellipse. */
function stadiumPath(x: number, y: number, w: number, h: number): Path {
  const r = Math.min(w, h) / 2;
  const k = r * KAPPA;
  const b = new PathBuilder();

  if (w >= h) {
    const left = x + r;
    const right = x + w - r;
    const top = y;
    const bottom = y + h;
    const midY = y + h / 2;
    return b
      .moveTo(left, top)
      .lineTo(right, top)
      .curveTo(right + k, top, x + w, midY - k, x + w, midY)
      .curveTo(x + w, midY + k, right + k, bottom, right, bottom)
      .lineTo(left, bottom)
      .curveTo(left - k, bottom, x, midY + k, x, midY)
      .curveTo(x, midY - k, left - k, top, left, top)
      .close()
      .build();
  }

  const top = y + r;
  const bottom = y + h - r;
  const left = x;
  const right = x + w;
  const midX = x + w / 2;
  return b
    .moveTo(right, top)
    .lineTo(right, bottom)
    .curveTo(right, bottom + k, midX + k, y + h, midX, y + h)
    .curveTo(midX - k, y + h, left, bottom + k, left, bottom)
    .lineTo(left, top)
    .curveTo(left, top - k, midX - k, y, midX, y)
    .curveTo(midX + k, y, right, top - k, right, top)
    .close()
    .build();
}

export const FLOWCHART_OUTLINES = { rect, diamond, stadium, ellipse, parallelogram, trapezoid, hexagon };
