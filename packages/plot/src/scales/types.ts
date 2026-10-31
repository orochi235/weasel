/** What every positional scale answers, and what an axis is drawn from: where a value sits along its range, the
 *  values an axis marks, and how one reads. */
export interface Scale<T> {
  readonly kind: 'linear' | 'log' | 'band' | 'time';
  /** Where the scale's output runs, in drawing units: start to end, either way round. */
  readonly range: readonly [number, number];
  /** Where `value` sits along the range. A band scale answers its band's center. */
  position(value: T): number;
  /** The values an axis marks, about `count` of them where the scale chooses. */
  ticks(count?: number): T[];
  /** `value` as an axis label reads it. */
  format(value: T): string;
}

/** A scale over numbers that maps both ways. */
export interface ContinuousScale extends Scale<number> {
  readonly kind: 'linear' | 'log' | 'time';
  readonly domain: readonly [number, number];
  /** `value` along the range; the same as {@link Scale.position}. */
  map(value: number): number;
  /** The value at `at` along the range. */
  invert(at: number): number;
}
