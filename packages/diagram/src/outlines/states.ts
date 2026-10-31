/**
 * State-machine figures: the filled dot a machine starts at, the bullseye it
 * ends at, and the bar a fork splits at and a join meets at. Each keeps its
 * own proportions inside whatever box it is given, centered, so a box laid out
 * wider than the figure leaves it the same figure.
 */
import { rectPath } from '@weasel-js/core/math';
import { ellipsePath } from '@weasel-js/geom';
import type { Bounds, OutlineDef } from './types';

/** The largest square centered in `b`. */
function square({ x, y, width: w, height: h }: Bounds): Bounds {
  const side = Math.min(w, h);
  return { x: x + (w - side) / 2, y: y + (h - side) / 2, width: side, height: side };
}

/** `b` shrunk by `k` about its center. */
function scaled(b: Bounds, k: number): Bounds {
  const w = b.width * k;
  const h = b.height * k;
  return { x: b.x + (b.width - w) / 2, y: b.y + (b.height - h) / 2, width: w, height: h };
}

/** The end state's dot, as a share of its ring. */
const BULLSEYE = 0.55;
/** A bar's thickness across its length, at most. */
const BAR = 6;

const circle = (b: Bounds) => ellipsePath(square(b));

const start: OutlineDef = {
  path: circle,
  solid: circle,
};

const end: OutlineDef = {
  path: circle,
  solid: (b) => ellipsePath(scaled(square(b), BULLSEYE)),
};

/** A bar along the box's longer side, {@link BAR} thick, centered. */
function barOf({ x, y, width: w, height: h }: Bounds): Bounds {
  if (w >= h) {
    const t = Math.min(BAR, h);
    return { x, y: y + (h - t) / 2, width: w, height: t };
  }
  const t = Math.min(BAR, w);
  return { x: x + (w - t) / 2, y, width: t, height: h };
}

const bar: OutlineDef = {
  path: (b) => {
    const r = barOf(b);
    return rectPath(r.x, r.y, r.width, r.height);
  },
  solid: (b) => {
    const r = barOf(b);
    return rectPath(r.x, r.y, r.width, r.height);
  },
};

export const STATE_OUTLINES = { start, end, bar };
