import { passAt, passesOf as blitsPassesOf, phaseAt } from '@msb235/blits';

/** Which pass `elapsed` falls in and how far through it. `edge` reads the
 *  start of a pass after the first as the end of the one before. */
export function placeOf(
  elapsed: number,
  duration: number,
  passes: number,
  edge: boolean,
): { pass: number; phase: number } {
  return { pass: passAt(elapsed, duration, passes, edge), phase: phaseAt(elapsed, duration, passes, edge) };
}

/** How many passes `loop` makes; a fraction ends partway through the last, and a run makes at least one. */
export const passesOf = (loop: boolean | number): number => Math.max(1, blitsPassesOf(loop));
