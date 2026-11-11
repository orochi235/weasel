/**
 * The numbers an arrowhead is cut from, and how a line's shaft and head share
 * its length on screen. The line pass's vertex shader repeats {@link layoutLine}
 * in GLSL; the two must agree.
 */

/**
 * An arrowhead, set by the shaft it caps: a line is set by its width alone and
 * its head follows, so a wide line is still an arrow rather than a band with a
 * small head poking out of it.
 */
export interface HeadShape {
  /** The head's length, in multiples of half the shaft's width. */
  lenRatio: number;
  /** The most of the line's on-screen length the head may take. */
  maxShare: number;
  /** Half the head's base as a share of its length. The cap shortens a head; it never reshapes it. */
  aspect: number;
}

/** A 16 px head 14 px across on a 4 px shaft, taking at most half the line. */
export const HEAD: HeadShape = { lenRatio: 8, maxShare: 0.5, aspect: 7 / 16 };

/**
 * How far the shaft runs on under the head, as a share of the head's length:
 * enough to close the seam between them, little enough that a curving shaft
 * stays inside the triangle.
 */
export const HEAD_OVERDRAW = 0.1;

/** The head a shaft carries, in pixels, and the shaft that goes under it. */
export interface HeadSize {
  /** The head's length. */
  headLen: number;
  /** Half the head's base. */
  headHalf: number;
  /** Half the shaft's width: narrowed by whatever the cap took off the head. */
  shaftHalf: number;
}

/**
 * The head `shaftHalf` carries on a line `linePx` long on screen. The head is
 * capped at `head.maxShare` of the line, and the shaft narrows by the share
 * the cap took, so a short line is the same arrow drawn smaller rather than a
 * full-width band with a stub on the end. Left out, `linePx` caps nothing.
 */
export function headFor(shaftHalf: number, linePx = Number.POSITIVE_INFINITY, head: HeadShape = HEAD): HeadSize {
  const wanted = shaftHalf * head.lenRatio;
  // A head allowed no share of the line has none, however long the line: 0 · ∞ is no cap to lift.
  const cap = head.maxShare === 0 ? 0 : head.maxShare * linePx;
  const headLen = Math.max(0, Math.min(wanted, cap));
  const headHalf = headLen * head.aspect;
  const shrunk = wanted > 0 ? (shaftHalf * headLen) / wanted : shaftHalf;
  return { headLen, headHalf, shaftHalf: wanted > 0 ? Math.min(shrunk, headHalf) : shrunk };
}

/** {@link HeadSize}, plus where along the line its shaft stops. */
export interface LineLayout extends HeadSize {
  /** Where the shaft ends, in the line's own length units. */
  shaftEnd: number;
}

/**
 * How a line `length` long in its own units, drawn at `pxPerUnit` pixels per
 * unit near its tip, splits between shaft and head. A line with no head
 * (`head` null) or no known scale runs its shaft to the end.
 */
export function layoutLine(
  shaftHalf: number, length: number, pxPerUnit: number, head: HeadShape | null,
): LineLayout {
  if (!head || !(pxPerUnit > 0)) return { headLen: 0, headHalf: 0, shaftHalf, shaftEnd: length };
  const size = headFor(shaftHalf, pxPerUnit * length, head);
  return { ...size, shaftEnd: length - (size.headLen / pxPerUnit) * (1 - HEAD_OVERDRAW) };
}
