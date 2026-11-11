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
  // Steps are counted from `base` rather than paid off a running sum, so how the frames slice
  // a span of time cannot change how many steps it owes.
  let base = 0;
  let paid = 0;
  let span = Number.NaN;
  return {
    owed(elapsed, stepMs) {
      // A step of 0 would owe Infinity steps; one that is not a positive span steps once a moving frame.
      if (!(stepMs > 0 && stepMs < Infinity)) {
        const moved = elapsed > (paid > 0 ? base + paid * span : base);
        base = elapsed;
        paid = 0;
        span = Number.NaN;
        return moved ? 1 : 0;
      }
      if (stepMs !== span) {
        if (paid > 0) base += paid * span;
        paid = 0;
        span = stepMs;
      }
      const due = elapsed < base ? -1 : Math.floor((elapsed - base) / stepMs);
      if (due < paid) {
        base = elapsed;
        paid = 0;
        return 0;
      }
      const n = due - paid;
      paid = due;
      return n;
    },
    rebase(elapsed) {
      base = elapsed;
      paid = 0;
    },
  };
}
