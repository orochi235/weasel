/**
 * fast-check arbitraries shared by guides' property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { Bounds } from '@weasel-js/core';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** A finite double in `±limit`. */
export function coord(limit = 1000): fc.Arbitrary<number> {
  return fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true });
}

/** A multiple of 1/8 in `±limit`: exact, so sums and differences of a few compare with `===`. */
export function eighth(limit = 1000): fc.Arbitrary<number> {
  return fc.integer({ min: -limit * 8, max: limit * 8 }).map((n) => n / 8);
}

/** A positive multiple of 1/8 up to `max`. */
export function posEighth(max = 200): fc.Arbitrary<number> {
  return fc.integer({ min: 1, max: Math.max(1, Math.floor(max * 8)) }).map((n) => n / 8);
}

/** A pitch, from fine to coarse. */
export const pitch = fc.oneof(
  fc.double({ min: 1e-3, max: 1e3, noNaN: true }),
  fc.constantFrom(0.1, 0.25, 1, 8, 10, 25.4),
);

/** A box on the eighth lattice, with or without area. */
export function box(limit = 500, maxSize = 200, minSize = 0): fc.Arbitrary<Bounds> {
  return fc.record({
    x: eighth(limit),
    y: eighth(limit),
    width: fc.integer({ min: minSize * 8, max: maxSize * 8 }).map((n) => n / 8),
    height: fc.integer({ min: minSize * 8, max: maxSize * 8 }).map((n) => n / 8),
  });
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
