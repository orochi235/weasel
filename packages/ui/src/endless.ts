/** Which end of a slider stands for infinity. */
export type Endless = 'min' | 'max' | 'both';

/** Whether the `max` end (`sign` 1) or the `min` end (`sign` −1) is endless. */
export function endlessAt(endless: Endless | undefined, sign: 1 | -1): boolean {
  return endless === 'both' || endless === (sign > 0 ? 'max' : 'min');
}

/** Whether `n` is an infinity that `endless` allows as a value. */
export function endlessAllows(endless: Endless | undefined, n: number): boolean {
  return (n === Infinity && endlessAt(endless, 1)) || (n === -Infinity && endlessAt(endless, -1));
}

/** A slider's track with a stop for infinity added beyond each endless end,
 *  so every value from `min` to `max` stays reachable. */
export interface EndlessTrack {
  /** The track's own ends: `min` and `max`, each moved out by one stop where endless. */
  min: number;
  max: number;
  /** Where a value sits on the track: ±Infinity at the end it belongs to. */
  toTrack: (value: number) => number;
  /** The value a track position stands for: beyond the range, infinity or the
   *  range's end, whichever is nearer. */
  fromTrack: (at: number) => number;
}

/** The added stop sits one `step` beyond the range, or a twentieth of the
 *  range where the track has no step. */
export function endlessTrack(min: number, max: number, step: number | undefined, endless: Endless | undefined): EndlessTrack {
  const gap = step !== undefined && step > 0 ? step : (max - min) / 20;
  const lo = endlessAt(endless, -1) ? min - gap : min;
  const hi = endlessAt(endless, 1) ? max + gap : max;
  return {
    min: lo,
    max: hi,
    toTrack: value => (value === Infinity ? hi : value === -Infinity ? lo : value),
    fromTrack: at =>
      at > max ? (hi > max && at - max >= gap / 2 ? Infinity : max)
      : at < min ? (lo < min && min - at >= gap / 2 ? -Infinity : min)
      : at,
  };
}
