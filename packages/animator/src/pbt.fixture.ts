/**
 * Helpers shared by the animator's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { hostAnimator, type HostedAnimator } from './hostAnimator';

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

/** A hosted animator on a clock the test moves: `at(t)` sets the clock and runs a frame there. */
export function clocked(): HostedAnimator & { at(t: number): void; now(): number } {
  let now = 0;
  const hosted = hostAnimator({ now: () => now, requestFrame: () => {} });
  return {
    ...hosted,
    at(t) { now = t; hosted.tick(t); },
    now: () => now,
  };
}

/** A finite double of moderate size, ends included. */
export const moderate = (max = 1e6): fc.Arbitrary<number> => fc.oneof(
  fc.double({ min: -max, max, noNaN: true, noDefaultInfinity: true }),
  fc.integer({ min: -100, max: 100 }),
  fc.constantFrom(0, -0, 1, -1),
);

/** A channel in 0..1, ends included. */
export const unit = fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom(0, 1));

/** `n` anchors' flat RGBA, 0..1. */
export const rgbaArray = (n: number): fc.Arbitrary<number[]> => fc.array(unit, { minLength: 4 * n, maxLength: 4 * n });

