/**
 * The dot grid of an output target, a printer or a 1-bit panel, in document
 * units: one dot's size, and where the corner of dot (0, 0) sits.
 */
export interface OutputGrid {
  pitch: number;
  origin: { x: number; y: number };
}
