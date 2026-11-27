/**
 * A measurement that runs on between updates: `value` as measured, `at` the host time it arrived
 * (`performance.now()`), and `rate` the value units it moves per host millisecond: 1/1000 for a
 * count of seconds, 0 for one paused or done. Plain data, so it crosses a wire or a worker.
 */
export interface Reading {
  readonly value: number;
  readonly at: number;
  readonly rate: number;
  /**
   * A value it shows until its own line passes it, set by {@link nextReading} when an update
   * lands behind what was already shown, so a count never runs backward.
   */
  readonly hold?: number;
}

/** Options for {@link nextReading}. */
export interface ReadingOptions {
  /** The longest, in host ms, an update may hold the shown value before its line catches up; one
   *  further behind snaps back. Default 2000. */
  maxHold?: number;
}

const MAX_HOLD = 2000;

/** The value `r` shows at host time `now`: its line, or its hold while the line is still behind it. */
export function readingAt(r: Reading, now: number): number {
  const line = r.value + r.rate * (now - r.at);
  if (r.hold === undefined) return line;
  return r.rate > 0 ? Math.max(r.hold, line) : Math.min(r.hold, line);
}

/** The host time `r`'s hold lets go, its line reaching the held value; `r.at` when nothing is held. */
export function holdEndOf(r: Reading): number {
  return r.hold === undefined ? r.at : r.at + (r.hold - r.value) / r.rate;
}

/**
 * `next` as it should show after `shown`: on a new line, but holding the value `shown` reached when
 * `next` lands behind it in the direction it moves, until it catches up, so a count never runs
 * backward. An update further behind than `maxHold` of host time, or one that stands still, snaps.
 */
export function nextReading(shown: Reading | undefined, next: Reading, options: ReadingOptions = {}): Reading {
  const { hold: _drop, ...line } = next;
  if (shown === undefined || next.rate === 0) return line;
  const reached = readingAt(shown, next.at);
  const behind = (reached - next.value) * Math.sign(next.rate);
  if (!(behind > 0) || behind / Math.abs(next.rate) > (options.maxHold ?? MAX_HOLD)) return line;
  return { ...line, hold: reached };
}
