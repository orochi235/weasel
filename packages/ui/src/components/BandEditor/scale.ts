/**
 * Maps a domain value onto its position along the track, and back.
 *
 * Deliberately narrow — two functions over an explicit `[min, max]` — rather
 * than a general scale type for the package. `Plot2D`, `CurveEditor` and
 * `@weasel-js/core` each already use "scale" or "domain" to mean something
 * else; generalizing is a job for a second consumer that needs one.
 */
export interface BandScale {
  /** Domain → position in [0,1]. Must be monotonic increasing. */
  toUnit(value: number, min: number, max: number): number;
  /** Inverse of `toUnit`. */
  fromUnit(unit: number, min: number, max: number): number;
}

export function clamp01(u: number): number {
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

/** Even domain steps take even track steps. */
export const linearScale: BandScale = {
  toUnit: (value, min, max) => (max === min ? 0 : (value - min) / (max - min)),
  fromUnit: (unit, min, max) => min + unit * (max - min),
};

/** Even *ratios* take even track steps. Requires `min > 0`. */
export const logScale: BandScale = {
  toUnit: (value, min, max) => {
    const lo = Math.log(min);
    const hi = Math.log(max);
    return hi === lo ? 0 : (Math.log(value) - lo) / (hi - lo);
  },
  fromUnit: (unit, min, max) => {
    const lo = Math.log(min);
    return Math.exp(lo + unit * (Math.log(max) - lo));
  },
};

let warnedNonPositiveMin = false;

function isDev(): boolean {
  return typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
}

/**
 * Resolves the `scale` prop, substituting `linearScale` for a `logScale`
 * that `min` would send to `NaN`.
 */
export function resolveScale(
  scale: 'linear' | 'log' | BandScale | undefined,
  min: number,
): BandScale {
  const requested =
    scale === undefined || scale === 'log'
      ? logScale
      : scale === 'linear'
        ? linearScale
        : scale;

  if (requested !== logScale || min > 0) return requested;

  if (isDev() && !warnedNonPositiveMin) {
    warnedNonPositiveMin = true;
    console.warn(
      `BandEditor: a log scale needs min > 0, but min is ${min}. Falling back to a linear scale. ` +
        `Pass scale="linear" to silence this.`,
    );
  }
  return linearScale;
}
