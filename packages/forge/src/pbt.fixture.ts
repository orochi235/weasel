/**
 * fast-check arbitraries shared by forge's property tests: keys drawn from small pools so collisions happen, with
 * `Object.prototype` member names among them. Test-only: nothing in the package imports it.
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

/** Names an object's prototype answers to, which every reader must treat as plain own keys. */
export const PROTO_KEYS = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'] as const;

/** A key: short and colliding, a prototype member's name, or any well-formed text. */
export const key = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom('a', 'b', 'c', 'size', 'label', 'x y', 'é', '1') },
  { weight: 2, arbitrary: fc.constantFrom(...PROTO_KEYS) },
  { weight: 1, arbitrary: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 6 }) },
);

/** Well-formed text of any kind: escapes, separators, and characters outside the BMP. */
export const text = fc.oneof(
  { weight: 3, arbitrary: fc.string({ unit: 'grapheme', maxLength: 12 }) },
  { weight: 2, arbitrary: fc.constantFrom('', ' ', '&', '=', '?', '#', '%', '%2', '+', '/', 'a b', 'x&y=z', '\u{1F600}', 'é', '.', '$') },
  { weight: 1, arbitrary: fc.string({ unit: 'binary', maxLength: 8 }).filter((s) => !/\p{Cs}/u.test(s)) },
);

/** A finite double of any size, weighted toward the ends. */
export const anyFinite = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: -1000, max: 1000 }) },
  { weight: 3, arbitrary: fc.double({ noNaN: true, noDefaultInfinity: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -0, 1e21, -1e21, 1e-7, Number.MAX_VALUE, -Number.MAX_VALUE, 5e-324) },
);

/** JSON data: what a plain-object or array knob holds. */
export const json: fc.Arbitrary<unknown> = fc.jsonValue({ maxDepth: 3 }).map((v) => JSON.parse(JSON.stringify(v)) as unknown);

/** A plain object of JSON data, keys from {@link key}, prototype names included as own keys. */
export const jsonObject: fc.Arbitrary<Record<string, unknown>> = fc
  .array(fc.tuple(key, json), { maxLength: 4 })
  .map((entries) => Object.fromEntries(entries));
