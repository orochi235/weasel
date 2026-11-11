/**
 * fast-check helpers shared by audio's property tests: the run count, a timeout that scales with it, and tally
 * guards. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';

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

/** A finite double of any size, weighted toward small values and the ends of the range. */
export const anyFinite = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: -1000, max: 1000 }) },
  { weight: 3, arbitrary: fc.double({ noNaN: true, noDefaultInfinity: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -0, 1, -1, 1e308, -1e308, Number.MAX_VALUE, -Number.MAX_VALUE, 5e-324, 1e-300) },
);

/** A time in ms, zero to large, weighted toward the short ones envelopes take. */
export const ms = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 2000 }) },
  { weight: 2, arbitrary: fc.double({ min: 0, max: 1e6, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, 5e-324, 1e-9, 1e300) },
);
