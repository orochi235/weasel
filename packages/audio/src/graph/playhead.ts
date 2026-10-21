/**
 * Where a buffer source is in its buffer at a context time, given when it
 * started and stopped and the playback rate it followed, ramps included.
 */
export interface Playhead {
  /** A node starts at `when`, or at `now` if that is later. Returns its offset. */
  start(when: number, now: number): number;
  /** The node stops at `when`, or at `now` if that is later. */
  stop(when: number, now: number): void;
  /** The rate moves linearly from where it is now to `value` over `rampMs`. */
  rate(value: number, rampMs: number, now: number): void;
  /** Back to the top, as a non-looping buffer that played out. */
  rewind(now: number): void;
}

export function createPlayhead(duration: number, loop: boolean, initialRate: number): Playhead {
  /** The position at `from`; it moves only between `from` and `until`. */
  let pos = 0;
  let from = 0;
  let until = 0;
  /** The rate: `r0` at `t0`, ramping linearly to `r1` at `t1`, then held. */
  let t0 = 0;
  let r0 = initialRate;
  let t1 = 0;
  let r1 = initialRate;

  const rateAt = (t: number): number => {
    if (t >= t1) return r1;
    return t <= t0 ? r0 : r0 + ((r1 - r0) * (t - t0)) / (t1 - t0);
  };
  /** The distance covered from `t0` to `t`. */
  const distance = (t: number): number =>
    t <= t1 ? ((t - t0) * (r0 + rateAt(t))) / 2 : ((t1 - t0) * (r0 + r1)) / 2 + (t - t1) * r1;
  const wrap = (p: number): number =>
    loop ? ((p % duration) + duration) % duration : Math.min(Math.max(p, 0), duration);
  const at = (t: number): number => {
    const x = Math.min(Math.max(t, from), until);
    return x <= from ? wrap(pos) : wrap(pos + distance(x) - distance(from));
  };
  const hold = (t: number, rate: number): void => {
    t0 = t;
    t1 = t;
    r0 = rate;
    r1 = rate;
  };

  return {
    start(when, now) {
      pos = at(until);
      from = Math.max(when, now);
      until = Infinity;
      hold(now, r1);
      return pos;
    },
    stop(when, now) {
      until = Math.max(when, now, from);
    },
    rate(value, rampMs, now) {
      pos = at(now);
      from = Math.min(Math.max(now, from), until);
      r0 = rateAt(now);
      t0 = now;
      t1 = now + Math.max(0, rampMs) / 1000;
      r1 = value;
    },
    rewind(now) {
      pos = 0;
      from = now;
      until = now;
    },
  };
}
