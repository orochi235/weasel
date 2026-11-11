/**
 * fast-check helpers shared by storage's property tests: run counts, tally guards, keys that crowd a prefix's
 * edges, JSON values and structured-clone values, and a strict equality that sees prototypes, holes, and `-0`.
 * Test-only: nothing in the package imports it.
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

const anyKey = fc.constantFrom(
  'a', 'a:', 'a:x', 'a:y', 'a:\uffff', 'a:\uffff\uffff', 'a;', 'ab', 'b', 'b:x', '', '__proto__', 'constructor', 'toString', '\uffff', 'é', '😀',
);

/** Keys from a small pool, so they collide, share prefixes, and sit at a prefix's upper edge. */
export const key = fc.oneof({ weight: 4, arbitrary: fc.constantFrom('a:x', 'a:\uffff', '__proto__') }, { weight: 1, arbitrary: anyKey });

/** Prefixes over {@link key}'s pool, the empty one included. */
export const prefix = fc.constantFrom('', 'a', 'a:', 'a:\uffff', 'b', '__', '\uffff', 'z');

const text = fc.oneof(fc.constantFrom('', 'x', '__proto__', '{"a":1}', '"quoted"', 'null', '1e3', '\u2028'), fc.string({ maxLength: 6 }));
const finite = fc.oneof(fc.integer({ min: -1000, max: 1000 }), fc.double({ noNaN: true, noDefaultInfinity: true }).filter((n) => !Object.is(n, -0)));
const objectKey = fc.constantFrom('a', 'b', '__proto__', 'constructor', 'toString', '', '0', 'é');

/** A plain object holding `value`s under keys an object inherits too, as `JSON.parse` would build it. */
const record = <T>(value: fc.Arbitrary<T>): fc.Arbitrary<Record<string, T>> =>
  fc.array(fc.tuple(objectKey, value), { maxLength: 4 }).map((pairs) => {
    const out: Record<string, T> = {};
    for (const [k, v] of pairs) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
    return out;
  });

/** Values JSON keeps exactly. */
export const jsonValue: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof({ depthSize: 'small', withCrossShrink: true }, fc.constant(null), fc.boolean(), finite, text, tie('array'), tie('object')),
  array: fc.array(tie('value'), { maxLength: 4 }),
  object: record(tie('value')),
})).value;

/** Values only a structured-clone substrate keeps: binary, `Map`, `Set`, `Date`, `-0`, `NaN`, `undefined` in a list. */
export const cloneValue: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    jsonValue,
    fc.constantFrom(-0, Number.NaN, Infinity, -Infinity, 10n),
    fc.uint8Array({ maxLength: 6 }),
    fc.date({ noInvalidDate: true }),
    fc.array(fc.oneof(tie('value'), fc.constant(undefined)), { maxLength: 3 }),
    fc.array(fc.tuple(text, tie('value')), { maxLength: 3 }).map((pairs) => new Map(pairs)),
    fc.array(finite, { maxLength: 3 }).map((xs) => new Set(xs)),
    record(tie('value')),
  ),
})).value;

/** Whether `a` and `b` are the same value all the way down: prototypes, own keys, holes, and `Object.is` leaves. */
export function same(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return Object.is(a, b);
  const tag = Object.prototype.toString.call(a);
  if (tag !== Object.prototype.toString.call(b)) return false;
  if (a instanceof Date || tag === '[object Date]') return Object.is((a as Date).getTime(), (b as Date).getTime());
  if (tag === '[object Uint8Array]') return [...(a as Uint8Array)].join() === [...(b as Uint8Array)].join();
  if (tag === '[object Map]') {
    const x = [...(a as Map<unknown, unknown>)];
    const y = [...(b as Map<unknown, unknown>)];
    return x.length === y.length && x.every(([k, v], i) => same(k, y[i]![0]) && same(v, y[i]![1]));
  }
  if (tag === '[object Set]') return same([...(a as Set<unknown>)], [...(b as Set<unknown>)]);
  const protoA = Object.getPrototypeOf(a);
  const protoB = Object.getPrototypeOf(b);
  // Some realm's `Object.prototype`: under jsdom `structuredClone` builds its copies in Node's.
  const plain = (p: unknown): boolean => p === null || (Object.getPrototypeOf(p) === null && Object.prototype.toString.call(p) === '[object Object]');
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (!Array.isArray(a) && !(protoA === protoB || (plain(protoA) && plain(protoB)))) return false;
  if (Array.isArray(a) && (a as unknown[]).length !== (b as unknown[]).length) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k)
    && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
