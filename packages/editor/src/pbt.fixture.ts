/**
 * fast-check arbitraries shared by editor's property tests. Test-only: nothing in the package imports it.
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

/** Keys a document's data can hold: the ones a path's typed arrays sit under, the ones a tagged typed array is
 *  written with, prototype names, and plain ones. */
export const dataKey = fc.constantFrom('commands', 'coords', '__ta', 'data', '__raw', '__proto__', 'constructor', 'toString', 'fill', 'x', '0', '1');

const typed = fc.oneof(
  fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 6 }).map((a) => Uint8Array.from(a)),
  fc.array(fc.float({ noNaN: true, noDefaultInfinity: true }), { maxLength: 6 }).map((a) => Float32Array.from(a)),
  fc.array(fc.double({ noNaN: true, noDefaultInfinity: true }), { maxLength: 4 }).map((a) => Float64Array.from(a)),
  fc.array(fc.integer({ min: -32768, max: 32767 }), { maxLength: 4 }).map((a) => Int16Array.from(a)),
);

const leaf = fc.oneof(
  fc.double({ noNaN: true, noDefaultInfinity: true }).map((n) => n + 0),
  fc.integer({ min: -300, max: 300 }),
  fc.string({ maxLength: 4 }),
  fc.boolean(),
  fc.constant(null),
  fc.constantFrom('u8', 'f32'),
);

/** An object with own keys, `__proto__` among them as a plain own key, as `JSON.parse` would make it. */
function objectOf(entries: [string, unknown][]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
}

/** A value a node's data can hold that JSON can carry, typed arrays anywhere in it. */
export const dataValue: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof({ depthSize: 'small', withCrossShrink: true }, leaf, typed, tie('array'), tie('object'), tie('lookalike')),
  array: fc.array(tie('value'), { maxLength: 4 }),
  object: fc.uniqueArray(fc.tuple(dataKey, tie('value')), { selector: ([k]) => k, maxLength: 4 }).map(objectOf),
  // Shapes a reader might mistake for something it wrote: a tag, a legacy path array, or a wrapper.
  lookalike: fc.oneof(
    fc.record({ __ta: fc.constantFrom('u8', 'f32', 'f64'), data: fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 3 }) }, { noNullPrototype: true }),
    fc.record({ commands: fc.array(fc.integer({ min: 0, max: 300 }), { maxLength: 3 }), coords: fc.array(fc.double({ min: -1, max: 1, noNaN: true }).map((n) => n + 0), { maxLength: 3 }) }, { noNullPrototype: true }),
    fc.record({ coords: fc.array(fc.constant(null), { maxLength: 2 }) }, { noNullPrototype: true }),
    fc.record({ commands: fc.constant({}) }, { noNullPrototype: true }),
    tie('value').map((v) => ({ __raw: v })),
  ),
})).value;
