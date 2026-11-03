/**
 * The dot grid of an output target, a printer or a 1-bit panel, in document
 * units: one dot's size, and where the corner of dot (0, 0) sits.
 *
 * The grid is a 2D raster with its rows and columns along the document's
 * axes. A mark lands on whole dots only where its edges run along them too:
 * under no rotation or a quarter turn, with no skew.
 */
export interface OutputGrid {
  pitch: number;
  origin: { x: number; y: number };
}

/** `value` as a whole number of dots of `pitch`, never below one, so a
 *  hairline keeps a dot rather than vanishing. */
export function snapToPitch(value: number, pitch: number): number {
  return Math.max(1, Math.round(value / pitch)) * pitch;
}

/** `pose` moved so its corner sits on the nearest corner of `grid`, size
 *  untouched. A mark a whole number of dots wide then has every edge on a
 *  dot boundary. */
export function alignToGrid<P extends { x: number; y: number }>(pose: P, grid: OutputGrid): P {
  const { pitch, origin } = grid;
  return {
    ...pose,
    x: origin.x + Math.round((pose.x - origin.x) / pitch) * pitch,
    y: origin.y + Math.round((pose.y - origin.y) / pitch) * pitch,
  };
}
