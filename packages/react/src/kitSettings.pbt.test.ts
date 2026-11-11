/**
 * A stateful property test of kit settings stores chained three deep, against a model: random `set`s on any store
 * of trees whose areas and leaves are named like `Object.prototype` members, with `NaN`, `-0`, and `undefined`
 * leaves, and subscribers that come and go. After every step each store reads every path as its own leaf else its
 * ancestors', and a listener heard a notice exactly when some leaf it reads through changed.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createKitSettingsStore, type WritableKitSettingsStore } from './kitSettings';
import { runs, tally, timeoutFor } from './pbt.fixture';

type Tree = Record<string, unknown>;
const AREAS = ['tree', '__proto__', 'constructor'];
const LEAVES = ['typeaheadMs', 'toString', 'valueOf'];
const PATHS = [...LEAVES, ...AREAS.flatMap((a) => LEAVES.map((l) => `${a}.${l}`))];

/** An object with every key its own, `__proto__` included, as `JSON.parse` makes one. */
const own = (pairs: [string, unknown][]): Tree => {
  const out: Tree = {};
  for (const [k, v] of pairs) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
};
const leaf = fc.constantFrom<unknown>(1, 2, 0, -0, Number.NaN, 'a', true, undefined);
const leaves = fc.uniqueArray(fc.tuple(fc.constantFrom(...LEAVES), leaf), { selector: ([k]) => k, maxLength: 3 });
const treeArb: fc.Arbitrary<Tree> = fc.tuple(leaves, fc.uniqueArray(fc.tuple(fc.constantFrom(...AREAS), leaves), { selector: ([k]) => k, maxLength: 2 }))
  .map(([top, areas]) => own([...top, ...areas.map(([a, l]) => [a, own(l)] as [string, unknown])]));

const read = (tree: Tree, path: string): unknown => {
  let at: unknown = tree;
  for (const key of path.split('.')) {
    if (at === null || typeof at !== 'object' || !Object.hasOwn(at, key)) return undefined;
    at = (at as Tree)[key];
  }
  return at;
};
const copy = (t: Tree): Tree => own(Object.entries(t).map(([k, v]) => [k, v !== null && typeof v === 'object' ? copy(v as Tree) : v]));
const counts = tally();

describe('kit settings stores against a model', () => {
  it('read through to their ancestors and notify exactly when a leaf read through changed', () => {
    const step = fc.oneof(
      fc.record({ op: fc.constant('set' as const), at: fc.nat({ max: 2 }), tree: treeArb }),
      // The store's own tree again, rebuilt: a set that changes nothing, `NaN` and `-0` leaves included.
      fc.record({ op: fc.constant('set' as const), at: fc.nat({ max: 2 }), tree: fc.constant(null) }),
      fc.record({ op: fc.constant('listen' as const), at: fc.nat({ max: 2 }) }),
      fc.record({ op: fc.constant('unlisten' as const), at: fc.nat({ max: 2 }) }),
    );
    fc.assert(fc.property(fc.array(step, { minLength: 5, maxLength: 60 }), (steps) => {
      const trees: Tree[] = [{}, {}, {}];
      // Typed loosely: the paths are prototype names no declared settings tree holds.
      type Loose = Record<string, never>;
      const stores: WritableKitSettingsStore<Loose>[] = [];
      for (let i = 0; i < 3; i++) stores.push(createKitSettingsStore<Loose>({}, stores[i - 1] ?? null));
      const resolved = (i: number, path: string): unknown => {
        for (let j = i; j >= 0; j--) {
          const v = read(trees[j]!, path);
          if (v !== undefined) return v;
        }
        return undefined;
      };
      const heard = [0, 0, 0];
      const offs: ((() => void) | null)[] = stores.map((store, i) => store.subscribe(() => { heard[i]!++; }));
      for (const s of steps) {
        if (s.op === 'listen' && !offs[s.at]) offs[s.at] = stores[s.at]!.subscribe(() => { heard[s.at]!++; });
        else if (s.op === 'unlisten' && offs[s.at]) {
          offs[s.at]!();
          offs[s.at] = null;
        } else if (s.op === 'set') {
          const tree = s.tree ?? copy(trees[s.at]!);
          // A store notifies when its own leaves change, and passes on each ancestor's notice.
          const flat = (t: Tree) => JSON.stringify(PATHS.map((p) => {
            const v = read(t, p);
            return v === undefined ? '-' : Object.is(v, -0) ? '-0' : typeof v === 'number' && Number.isNaN(v) ? 'NaN' : v;
          }));
          const changed = flat(trees[s.at]!) !== flat(tree);
          const before = [...heard];
          trees[s.at] = tree;
          stores[s.at]!.set(tree as never);
          counts.add(changed ? 'changed' : 'same');
          for (let i = 0; i < 3; i++) {
            const want = changed && i >= s.at && offs[i] ? 1 : 0;
            expect(heard[i]! - before[i]!, `store ${i}`).toBe(want);
          }
        }
        for (let i = 0; i < 3; i++) for (const p of PATHS) expect(stores[i]!.get(p as never)).toBe(resolved(i, p));
      }
    }), runs(200));
    expect(counts.get('changed')).toBeGreaterThan(50);
    expect(counts.get('same')).toBeGreaterThan(10);
  }, timeoutFor(200, 10));
});
