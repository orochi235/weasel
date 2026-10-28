/** Which pass `elapsed` falls in and how far through it. `edge` reads the
 *  start of a pass after the first as the end of the one before. */
export function placeOf(
  elapsed: number,
  duration: number,
  passes: number,
  edge: boolean,
): { pass: number; phase: number } {
  if (!(duration > 0) || !Number.isFinite(duration)) return { pass: 0, phase: 0 };
  if (elapsed >= duration * passes) return { pass: passes - 1, phase: 1 };
  const pass = Math.floor(elapsed / duration);
  if (edge && pass > 0 && elapsed === pass * duration) return { pass: pass - 1, phase: 1 };
  return { pass, phase: (elapsed % duration) / duration };
}

/** How many passes `loop` makes. */
export const passesOf = (loop: boolean | number): number =>
  loop === true ? Number.POSITIVE_INFINITY : loop === false ? 1 : Math.max(1, loop);
