/** Most a slewed value may change per second, in its own units, in each
 *  direction. A direction left out is unlimited: the value jumps to a target
 *  on that side. `0` holds the value where it is. */
export interface SlewRates {
  rise?: number;
  fall?: number;
}

function checkRate(name: string, rate: number | undefined): number {
  if (rate === undefined) return Infinity;
  if (!(rate >= 0)) throw new RangeError(`slew: ${name} must be a rate >= 0, got ${rate}`);
  return rate;
}

/**
 * One step of a slew limiter: `value` moved toward `target` by at most the
 * rate for that direction times `dt` seconds, landing on `target` rather than
 * passing it. A fast `rise` with a slow `fall` is an attack/release envelope.
 */
export function slewToward(value: number, target: number, dt: number, rates: SlewRates): number {
  const rise = checkRate('rise', rates.rise);
  const fall = checkRate('fall', rates.fall);
  if (target > value) return Math.min(target, value + rise * dt);
  if (target < value) return Math.max(target, value - fall * dt);
  return value;
}

/** A value that follows `target` at limited rates. Both fields are writable:
 *  set `target` to steer it, or write `value` to jump it and let it slew on
 *  from there. Nothing moves until `step` is called. */
export interface Slew {
  value: number;
  target: number;
  /** Advance `dt` seconds and return the new value. */
  step(dt: number): number;
}

/** A stateful {@link slewToward}. `target` defaults to `value`, so a new slew
 *  is at rest. */
export function createSlew(options: SlewRates & { value?: number; target?: number } = {}): Slew {
  const rates: SlewRates = { rise: checkRate('rise', options.rise), fall: checkRate('fall', options.fall) };
  const value = options.value ?? 0;
  const slew: Slew = {
    value,
    target: options.target ?? value,
    step(dt) {
      slew.value = slewToward(slew.value, slew.target, dt, rates);
      return slew.value;
    },
  };
  return slew;
}
