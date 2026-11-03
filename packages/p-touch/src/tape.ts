/**
 * Tape cassettes: how wide a label is, in the units each side of the pipeline counts in.
 */
import { TAPE } from 'bil-lbx';

/** A P-touch tape width, in the units `.lbx` files and printers each name it by. */
export interface Tape {
  /** The cassette's name, as P-touch prints it: `'12mm'`. */
  name: string;
  /** Width across the tape in millimeters, what a printer's status reply and media lookup use. */
  widthMm: number;
  /** Width across the tape in points, a label's height in the scene and in an `.lbx` file. */
  widthPt: number;
  /** Brother's format code for the tape, written to an `.lbx` file's paper. */
  format: number;
}

/** Every tape width `.lbx` files carry, narrowest first. */
export const TAPES: readonly Tape[] = Object.entries(TAPE).map(([name, { width, format }]) => ({
  name,
  // From the name, not the point width: 3.5mm does not round-trip through 72/25.4.
  widthMm: Number.parseFloat(name),
  widthPt: width,
  format,
}));

/** The tape `widthMm` wide, or undefined when no cassette is. */
export function tapeForWidthMm(widthMm: number): Tape | undefined {
  return TAPES.find((tape) => tape.widthMm === widthMm);
}

/** The tape named `name` (`'12mm'`), or undefined when no cassette is. */
export function tapeNamed(name: string): Tape | undefined {
  return TAPES.find((tape) => tape.name === name);
}
