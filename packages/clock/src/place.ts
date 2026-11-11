/** Which pass `elapsed` falls in and how far through it. `edge` reads the
 *  start of a pass after the first as the end of the one before. */
export function placeOf(
  elapsed: number,
  duration: number,
  passes: number,
  edge: boolean,
): { pass: number; phase: number } {
  if (!(duration > 0) || !Number.isFinite(duration)) return { pass: 0, phase: 0 };
  if (elapsed >= duration * passes) {
    const last = Math.ceil(passes) - 1;
    return { pass: last, phase: passes - last };
  }
  // The quotient and the remainder can round to different passes (`50 / 0.1` is 500, `50 % 0.1` nearly 0.1), so
  // the pass is settled against the product the phase is measured from.
  let pass = Math.floor(elapsed / duration);
  if (pass > 0 && pass * duration > elapsed) pass -= 1;
  else if ((pass + 1) * duration <= elapsed) pass += 1;
  if (edge && pass > 0 && elapsed === pass * duration) return { pass: pass - 1, phase: 1 };
  return { pass, phase: Math.min(1, Math.max(0, (elapsed - pass * duration) / duration)) };
}

/** How many passes `loop` makes; a fraction ends partway through the last. */
export const passesOf = (loop: boolean | number): number =>
  loop === true ? Number.POSITIVE_INFINITY : loop === false ? 1 : Math.max(1, loop);
