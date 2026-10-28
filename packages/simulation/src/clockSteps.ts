/** How many integrator steps a clock's time owes: one per `stepMs` it moves. */
export interface ClockSteps {
  /** The steps owed now the clock stands at `elapsed`, counted as paid. */
  owed(elapsed: number, stepMs: number): number;
  /** Owes nothing for the time up to `elapsed`. */
  rebase(elapsed: number): void;
}

/** A run is built up by stepping, so it cannot be unwound: time the clock goes back owes no
 *  steps, and the run carries on from where it stands once the clock moves forward again. */
export function createClockSteps(): ClockSteps {
  let paid = 0;
  return {
    owed(elapsed, stepMs) {
      if (elapsed < paid) {
        paid = elapsed;
        return 0;
      }
      const n = Math.floor((elapsed - paid) / stepMs);
      paid += n * stepMs;
      return n;
    },
    rebase(elapsed) { paid = elapsed; },
  };
}
