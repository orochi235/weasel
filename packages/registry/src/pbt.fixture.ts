/**
 * fast-check helpers shared by registry's property tests: run counts, tally guards, and values built from plain
 * objects (of this realm, another, and `structuredClone`'s), arrays with holes, and keys an object inherits too.
 * Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { runInNewContext } from 'node:vm';

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
      if (globalThis.process?.env?.PBT_TALLY) console.warn(`tally ${what}: ${seen.get(what) ?? 0} (wants ${n})`);
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

/** An empty plain object made in a fresh VM context: another realm's `Object.prototype` under it. */
export const foreignObject = (): Record<string, unknown> => runInNewContext('({})') as Record<string, unknown>;
/** An empty array made in a fresh VM context. */
export const foreignArray = (): unknown[] => runInNewContext('[]') as unknown[];

export const objectKey = fc.constantFrom('a', 'b', 'c', '__proto__', 'constructor', 'toString', 'hasOwnProperty', '', '0');

/** Where a plain object or array is made. */
export type Realm = 'here' | 'vm' | 'null';

/** A plain object of `realm` holding `pairs` as own keys, `__proto__` included. */
export function objectOf(pairs: readonly (readonly [string, unknown])[], realm: Realm): Record<string, unknown> {
  const out = realm === 'vm' ? foreignObject() : realm === 'null' ? Object.create(null) as Record<string, unknown> : {};
  for (const [k, v] of pairs) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
}

/** An array of `realm` holding `items`, with a hole wherever `holes` says. */
export function arrayOf(items: readonly unknown[], realm: Realm, holes: readonly boolean[] = []): unknown[] {
  const out = realm === 'vm' ? foreignArray() : [];
  items.forEach((v, i) => { if (!holes[i]) out[i] = v; });
  out.length = items.length;
  return out;
}

const realm = fc.constantFrom<Realm>('here', 'here', 'vm', 'null');
const leaf = fc.oneof(
  fc.constantFrom<unknown>(null, true, false, 0, -0, 1, NaN, Infinity, 'x', '', undefined),
  fc.integer({ min: -3, max: 3 }),
  fc.constantFrom('a', 'b'),
);

/** Values of arrays and plain objects over a small pool of leaves, so two drawn apart are often equal. */
export const value: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof({ depthSize: 'small', withCrossShrink: true }, leaf, tie('array'), tie('object')),
  array: fc.tuple(fc.array(tie('value'), { maxLength: 3 }), realm.filter((r) => r !== 'null'), fc.array(fc.boolean(), { maxLength: 3 }))
    .map(([items, r, holes]) => arrayOf(items, r, holes)),
  object: fc.tuple(fc.uniqueArray(fc.tuple(objectKey, tie('value')), { maxLength: 3, selector: ([k]) => k }), realm)
    .map(([pairs, r]) => objectOf(pairs, r)),
})).value;

/** `v` rebuilt from scratch, each object and array in a realm `pick` chooses: equal to it, sharing nothing. */
export function rebuild(v: unknown, pick: () => Realm): unknown {
  if (Array.isArray(v)) {
    const r = pick();
    return arrayOf(Array.from(v, (x) => rebuild(x, pick)), r === 'null' ? 'here' : r, Array.from(v, (_, i) => !(i in v)));
  }
  if (typeof v === 'object' && v !== null) return objectOf(Object.keys(v).map((k) => [k, rebuild((v as Record<string, unknown>)[k], pick)]), pick());
  return v;
}
