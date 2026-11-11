/** A rate on its way to `to`, `left` real ms from arriving. */
export interface Ramp {
  to: number;
  left: number;
  /** The real ms the whole ramp takes. */
  over: number;
}

/** What one step of `dt` real ms did: the ms of clock time it covered, the rate
 *  after it, the ramp still running (`null` once settled), and whether it settled. */
export interface RampStep {
  area: number;
  rate: number;
  ramp: Ramp | null;
  settled: boolean;
}

/** Steps `rate` over `dt` real ms along `ramp` (none: constant), integrating the
 *  clock time covered. Does not mutate `ramp`. */
export function stepRamp(rate: number, ramp: Ramp | null, dt: number): RampStep {
  if (!ramp) return { area: rate * dt, rate, ramp: null, settled: false };
  // `left` is what frames have subtracted, and drifts from the time the frame loop reports by a few ulps of `over`.
  if (dt >= ramp.left - 8 * Number.EPSILON * ramp.over) {
    const area = ((rate + ramp.to) / 2) * ramp.left + ramp.to * Math.max(0, dt - ramp.left);
    return { area, rate: ramp.to, ramp: null, settled: true };
  }
  const next = rate + ((ramp.to - rate) * dt) / ramp.left;
  return {
    area: ((rate + next) / 2) * dt,
    rate: next,
    ramp: { to: ramp.to, left: ramp.left - dt, over: ramp.over },
    settled: false,
  };
}
