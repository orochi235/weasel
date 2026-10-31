/** Maps a value onto its place along a slider's track, and back. */
export interface SliderScale {
  /** Value → place in [0, 1]. Must be monotonic increasing, and finite over `[min, max]`. */
  toUnit(value: number, min: number, max: number): number;
  /** Inverse of `toUnit`. */
  fromUnit(unit: number, min: number, max: number): number;
}

/** Even value steps take even track steps. */
export const linearScale: SliderScale = {
  toUnit: (value, min, max) => (max === min ? 0 : (value - min) / (max - min)),
  fromUnit: (unit, min, max) => min + unit * (max - min),
};

/** Even *ratios* take even track steps. Requires `min > 0`. */
export const logScale: SliderScale = {
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
