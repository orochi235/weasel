/**
 * fast-check helpers shared by clock's property tests: run counts, tally guards, clock declarations, and a mix
 * that records how it was driven. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { Clock, ClockedMix, ClockSpec } from './types';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** How often each path ran, so a property that exercised nothing fails rather than passes. */
export function tally(): { count(what: string): void; atLeast(what: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    count(what) { seen.set(what, (seen.get(what) ?? 0) + 1); },
    atLeast(what, n) {
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

/** Whether `a` and `b` agree to within float error at the size of `scale`. */
export const near = (a: number, b: number, scale = 1): boolean =>
  a === b || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(scale), Math.abs(a), Math.abs(b));

export const duration = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom(100, 1000, 250, 16.5, 3) },
  { weight: 2, arbitrary: fc.double({ min: 0.001, max: 1e6, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(1e-6, 1e12, 0.1, 1 / 3) },
);
export const loop = fc.constantFrom<boolean | number>(false, true, 1, 2, 3, 2.5, 0, -1, 1.25);
export const rate = fc.oneof(fc.constantFrom(0, 1, -1, 2, 0.5, -0.25, 4), fc.double({ min: -8, max: 8, noNaN: true }));

/** A declaration of a seekable clock, finite or endless. */
export const spec: fc.Arbitrary<ClockSpec> = fc.record({
  duration: fc.option(duration, { nil: undefined }),
  loop: fc.option(loop, { nil: undefined }),
  rate: fc.option(rate, { nil: undefined }),
  origin: fc.option(fc.constantFrom(0, 1000, -50, 0.5), { nil: undefined }),
  start: fc.option(fc.oneof(fc.constantFrom(0, 50, 1e9, -5), fc.double({ min: 0, max: 5000, noNaN: true })), { nil: undefined }),
}, { requiredKeys: [] });

/** A mix as a clock drives it: synced forward on its own host time, sought back. */
export function fakeMix(): ClockedMix & { host: number; seeks: number } {
  const mix = {
    now: 0, host: 0, seeks: 0,
    sync(timestamp: number) {
      if (timestamp < mix.host) throw new Error(`a mix's host time went back, from ${mix.host} to ${timestamp}`);
      mix.now += timestamp - mix.host;
      mix.host = timestamp;
    },
    seek(time: number) { mix.now = time; mix.seeks++; },
  };
  return mix;
}

/** Everything a clock reports, for comparing two. */
export const reading = (c: Clock) => ({
  elapsed: c.elapsed, pass: c.pass, phase: c.phase, ended: c.ended, rate: c.rate, duration: c.duration, loop: c.loop, origin: c.origin,
});
