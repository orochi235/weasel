/**
 * fast-check helpers shared by ui's property tests: run counts and tally guards. Test-only: nothing in the
 * package imports it.
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

/** A finite double, with the ends and small integers drawn often. */
export const finite = fc.oneof(
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: -1000, max: 1000, noNaN: true }),
  fc.integer({ min: -20, max: 20 }),
);

/** An 8-bit channel. */
export const byte = fc.integer({ min: 0, max: 255 });

/** A lowercase `#rrggbb`. */
export const hex6 = fc.tuple(byte, byte, byte).map(([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);

/** Keys that include `Object.prototype`'s names. */
export const key = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', '__proto__', 'constructor', 'toString'),
  fc.string({ maxLength: 3 }),
);
