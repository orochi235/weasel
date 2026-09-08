/**
 * The shapes a built body can wear, as paths in the node's bounds.
 *
 * These are the flowchart vocabulary — a decision is a diamond, an I/O step a
 * parallelogram, a terminator a stadium — plus `'rect'` for everything else and
 * a `Path` escape hatch for a shape the vocabulary does not have. The path is
 * built in world coordinates from the bounds it is given, the same way the
 * kit's own `clipFromPose` factories are.
 */
import { PathBuilder, polygonFromPoints, rectPath, type Path } from '@weasel-js/core';

/** An axis-aligned box, in the shape `PoseProjection.getBounds` returns. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A named flowchart shape, or a path a consumer built themselves. */
export type Outline = 'rect' | 'diamond' | 'stadium' | 'parallelogram' | Path;

/** How far a parallelogram's top edge leans past its bottom one, as a
 *  fraction of the box's width. The flowchart convention. */
const LEAN = 0.2;

/** Cubic approximation of a quarter circle. A stadium's ends are two of these
 *  each, which is the same construction `ellipsePath` uses. */
const KAPPA = 0.5522847498307936;

/** The path `outline` describes inside `bounds`. A zero-area box gives a
 *  zero-area rect rather than a degenerate polygon. */
export function outlinePath(outline: Outline, bounds: Bounds): Path {
  if (typeof outline !== 'string') return outline;
  const { x, y, width: w, height: h } = bounds;
  if (w <= 0 || h <= 0) return rectPath(x, y, Math.max(w, 0), Math.max(h, 0));

  switch (outline) {
    case 'rect':
      return rectPath(x, y, w, h);

    case 'diamond':
      return polygonFromPoints([
        { x: x + w / 2, y },
        { x: x + w, y: y + h / 2 },
        { x: x + w / 2, y: y + h },
        { x, y: y + h / 2 },
      ]);

    case 'parallelogram': {
      // The lean is clamped so a narrow box cannot fold through itself.
      const lean = Math.min(w * LEAN, w / 2);
      return polygonFromPoints([
        { x: x + lean, y },
        { x: x + w, y },
        { x: x + w - lean, y: y + h },
        { x, y: y + h },
      ]);
    }

    case 'stadium':
      return stadiumPath(x, y, w, h);
  }
}

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

/**
 * The largest axis-aligned box a shape's content can occupy without leaving
 * the shape. Rows lay out in here, not in the bounds — a diamond's corners and
 * a parallelogram's lean are outside its own box, and a label placed against
 * the bounding box lands there and gets clipped away by the silhouette.
 *
 * Conservative rather than exact: the inscribed rect of a rhombus is exact,
 * and a stadium reports the flat span between its rounded ends, which gives up
 * a little height near them.
 */
export function contentBox(outline: Outline, bounds: Bounds): Bounds {
  if (typeof outline !== 'string') return bounds;
  const { x, y, width: w, height: h } = bounds;
  switch (outline) {
    case 'rect':
      return bounds;
    case 'diamond':
      // Half the width and half the height, centered — the inscribed rect.
      return { x: x + w / 4, y: y + h / 4, width: w / 2, height: h / 2 };
    case 'parallelogram': {
      const lean = Math.min(w * LEAN, w / 2);
      return { x: x + lean, y, width: Math.max(w - lean * 2, 0), height: h };
    }
    case 'stadium': {
      const r = Math.min(w, h) / 2;
      return w >= h
        ? { x: x + r, y, width: Math.max(w - r * 2, 0), height: h }
        : { x, y: y + r, width: w, height: Math.max(h - r * 2, 0) };
    }
  }
}

/**
 * The box whose {@link contentBox} is at least `content` — the inverse, for
 * sizing a node to what its rows measured.
 *
 * The stadium case is the only inexact one: its inset depends on the height it
 * is solving for, so it assumes the wide orientation and adds one height's
 * worth of end caps.
 */
export function boxForContent(
  outline: Outline,
  content: { width: number; height: number },
): { width: number; height: number } {
  if (typeof outline !== 'string') return content;
  switch (outline) {
    case 'rect':
      return content;
    case 'diamond':
      return { width: content.width * 2, height: content.height * 2 };
    case 'parallelogram':
      return { width: content.width / (1 - LEAN * 2), height: content.height };
    case 'stadium':
      return { width: content.width + content.height, height: content.height };
  }
}
