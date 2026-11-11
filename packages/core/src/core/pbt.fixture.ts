/**
 * fast-check helpers shared by the property tests under `core/`. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { expect } from 'vitest';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** A finite double in `±limit`: fast-check's doubles, which crowd near zero, mixed with ones spread evenly. */
export function coord(limit = 1e4): fc.Arbitrary<number> {
  return fc.oneof(
    fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true }),
    fc.integer({ min: -1e9, max: 1e9 }).map((n) => (n / 1e9) * limit),
  );
}

/** A positive finite double in `[min, max]`. */
export function positive(min: number, max: number): fc.Arbitrary<number> {
  return fc.double({ min, max, noNaN: true, noDefaultInfinity: true });
}

/** `10^k` for `k` spread evenly over `[lo, hi]`: a magnitude spread over decades. */
export function decades(lo: number, hi: number): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: 1e6 }).map((n) => 10 ** (lo + ((hi - lo) * n) / 1e6));
}

/** A per-file count of the cases a property met, so one that exercised nothing fails rather than passes. */
export function tally(): { count(what: string): void; atLeast(what: string, n: number): void; seen: ReadonlyMap<string, number> } {
  const seen = new Map<string, number>();
  return {
    seen,
    count(what) { seen.set(what, (seen.get(what) ?? 0) + 1); },
    atLeast(what, n) { expect(seen.get(what) ?? 0, `${what}: ${JSON.stringify([...seen])}`).toBeGreaterThanOrEqual(n); },
  };
}

/** `|a - b|` within `tol` of the larger magnitude (and at least `tol` absolute). */
export function close(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}
