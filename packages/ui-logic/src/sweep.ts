/**
 * A parameter's domain, apart from how it is walked. A scrubber reads it
 * continuously, one value at a time (`at`); a stepped sequence reads every
 * step at once (`walk`). Time is one domain among others (`frames`).
 */
export interface Sweep<V> {
  /** The value `u` of the way along, 0 to 1, clamped: a scrubber's reading. A
   *  domain of discrete steps answers its nearest step. */
  at(u: number): V;
  /** Every step in order: a sequence's reading. May never end; `stepsOf` caps it. */
  walk(): Iterable<V>;
  /** How a value reads in a caption or a readout. */
  label(value: V): string;
}

/** How many steps `stepsOf` takes from a sweep that has not ended by then. */
export const SWEEP_CAP = 256;

/** The first `cap` steps of `sweep`, and whether it had more. */
export function stepsOf<V>(sweep: Sweep<V>, cap = SWEEP_CAP): { steps: V[]; capped: boolean } {
  const steps: V[] = [];
  for (const value of sweep.walk()) {
    if (steps.length === cap) return { steps, capped: true };
    steps.push(value);
  }
  return { steps, capped: false };
}

const clamp01 = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u);

/** Sums of a float step drift (0.1 * 3 is 0.30000000000000004); twelve digits keeps the step and drops the drift. */
const tidy = (n: number): number => +n.toPrecision(12);

const plain = (n: number): string => String(tidy(n));

/** What {@link range} walks: its ends, and either a `step` or a `count`. */
export type RangeSpec = {
  from: number;
  /** May be `Infinity`, for a walk that only `until` or a cap ends. */
  to: number;
  label?: (value: number) => string;
} & ({ step: number; count?: never } | { count: number; step?: never });

/**
 * Numbers from `from` to `to`, either `step` apart (the last step at or before
 * `to`) or `count` of them evenly spaced, both ends included. With `step`, `at`
 * snaps to a step; with `count` it is continuous, as the steps are only samples.
 */
export function range(spec: RangeSpec): Sweep<number> {
  const { from, to } = spec;
  if (!Number.isFinite(from) || Number.isNaN(to)) throw new RangeError(`a range runs from a finite number to a number, not ${from} to ${to}`);
  const span = to - from;
  if (spec.step !== undefined) {
    const step = spec.step;
    if (!(step > 0)) throw new RangeError(`a range's step is above 0, not ${step}`);
    const last = Number.isFinite(span) ? Math.floor(tidy(Math.abs(span) / step)) : Infinity;
    const dir = span < 0 ? -1 : 1;
    return {
      at: (u) => {
        if (!Number.isFinite(last)) throw new RangeError('an endless range has no point a fraction of the way along');
        return tidy(from + dir * step * Math.round(clamp01(u) * last));
      },
      *walk() {
        for (let i = 0; i <= last; i++) yield tidy(from + dir * step * i);
      },
      label: spec.label ?? plain,
    };
  }
  const count = spec.count;
  if (!(Number.isInteger(count) && count > 0)) throw new RangeError(`a range's count is a whole number above 0, not ${count}`);
  if (!Number.isFinite(span)) throw new RangeError('a range given a count needs a finite end');
  return {
    at: (u) => tidy(from + span * clamp01(u)),
    *walk() {
      if (count === 1) yield from;
      else for (let i = 0; i < count; i++) yield tidy(from + (span * i) / (count - 1));
    },
    label: spec.label ?? plain,
  };
}

/** The values of a list, in its order; `at` snaps to the nearest. */
export function values<V>(list: readonly V[], label: (value: V) => string = String): Sweep<V> {
  if (list.length === 0) throw new RangeError('a sweep over values needs at least one');
  return {
    at: (u) => list[Math.round(clamp01(u) * (list.length - 1))]!,
    walk: () => list,
    label,
  };
}

/** What `frames` reads of a clock's declaration; a `ClockSpec` is one. */
export interface FrameSpan {
  /** ms per pass; omitted, the run never ends. */
  duration?: number;
  /** Passes: `true` endless, `false` one, `n` that many. */
  loop?: boolean | number;
  /** The time elapsed 0 is shown as, for the labels. */
  origin?: number;
}

/** How {@link frames} walks a clock's run. */
export interface FrameOptions {
  /** ms between frames. */
  every: number;
  /** `'first'`, the default, walks one pass; `'all'` walks the whole run, which
   *  for an endless loop never ends. */
  passes?: 'first' | 'all';
  label?: (elapsed: number) => string;
}

const ms = (t: number): string => `${tidy(t)} ms`;

/**
 * The frames of a clock's run, as elapsed ms, `every` apart from 0. A run that
 * ends shows its last frame; a pass that loops back stops short of its end,
 * which is the next pass's start. `at` is continuous over the span walked.
 */
export function frames(span: FrameSpan, options: FrameOptions): Sweep<number> {
  const { every } = options;
  if (!(every > 0)) throw new RangeError(`frames are a time above 0 apart, not ${every}`);
  const duration = span.duration ?? Infinity;
  if (!(duration >= 0)) throw new RangeError(`a run lasts 0 ms or more, not ${duration}`);
  const loop = span.loop ?? false;
  const passes = loop === true ? Infinity : loop === false ? 1 : loop;
  const walked = options.passes === 'all' ? passes : 1;
  // No length times no end is no length, where the product is NaN.
  const end = duration === 0 || walked === 0 ? 0 : duration * walked;
  // The end is a frame only where nothing follows it: the run's end, not a pass's.
  const ends = walked === passes && Number.isFinite(passes) && Number.isFinite(end);
  const origin = span.origin ?? 0;
  const label = options.label ?? ((t: number) => ms(origin + t));
  return {
    at: (u) => {
      if (!Number.isFinite(end)) throw new RangeError('an endless run has no point a fraction of the way along');
      return end * clamp01(u);
    },
    *walk() {
      for (let i = 0; ; i++) {
        const t = tidy(every * i);
        if (t > end || (t === end && !ends)) break;
        yield t;
        if (t === end) return;
      }
      if (ends && tidy(end % every) !== 0) yield end;
    },
    label,
  };
}

/** `sweep` walked only as far as the step before the first one `done` accepts:
 *  "every frame until it repeats". `at` is the inner sweep's. */
export function until<V>(sweep: Sweep<V>, done: (value: V, index: number) => boolean): Sweep<V> {
  return {
    at: sweep.at,
    *walk() {
      let i = 0;
      for (const value of sweep.walk()) {
        if (done(value, i++)) return;
        yield value;
      }
    },
    label: sweep.label,
  };
}
