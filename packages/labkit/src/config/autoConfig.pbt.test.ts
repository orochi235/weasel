/**
 * Property tests of auto config: `resolveAutoConfig` against a brute-force evaluation of resolvers that read each
 * other in any order, a cycle among them named rather than run, and `applyConfigWrite` against a plain model of
 * the unpinned set.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { own, runs, tally, timeoutFor } from '../pbt.fixture';
import { auto } from './auto';
import { applyConfigWrite, resolveAutoConfig } from './autoConfig';
import { f } from './builder';
import { valueAtPath } from './path';
import { resolveConfigSchema } from './resolve';

const RUNS = 300;
const KEYS = ['a', 'b', 'c', 'd', '__proto__', 'constructor'] as const;

interface LeafPlan {
  key: string;
  pinned: number;
  auto: boolean;
  /** The keys its resolver sums, or null for a leaf auto with no resolver. */
  reads: readonly string[] | null;
}

const plan = fc.tuple(
  ...KEYS.map((key) =>
    fc.record({
      key: fc.constant(key),
      pinned: fc.integer({ min: 0, max: 9 }),
      auto: fc.boolean(),
      reads: fc.option(fc.subarray([...KEYS], { maxLength: 2 }), { nil: null, freq: 4 }),
    }),
  ),
) as fc.Arbitrary<LeafPlan[]>;

/** `c[k]` as a resolver reads it, which forces an unpinned `k` first; 0 for one `c` holds nothing at. */
const read = (c: Record<string, unknown>, k: string): number => {
  const v = c[k];
  return Object.hasOwn(c, k) ? ((v as number | undefined) ?? 0) : 0;
};

/** What each leaf comes to, or the cycle that stops it, worked out from the plan alone. */
function expected(leaves: readonly LeafPlan[]): Map<string, number | undefined> | 'cycle' {
  const by = new Map(leaves.map((l) => [l.key, l]));
  const out = new Map<string, number | undefined>();
  const visiting = new Set<string>();
  const value = (k: string): number | undefined => {
    const l = by.get(k);
    if (!l) return undefined;
    if (!l.auto) return l.pinned;
    if (l.reads === null) return undefined;
    if (out.has(k)) return out.get(k);
    if (visiting.has(k)) throw new Error('cycle');
    visiting.add(k);
    const v = 1 + l.reads.reduce((sum, d) => sum + (value(d) ?? 0), 0);
    visiting.delete(k);
    out.set(k, v);
    return v;
  };
  try {
    for (const l of leaves) out.set(l.key, value(l.key));
  } catch {
    return 'cycle';
  }
  return out;
}

describe('resolveAutoConfig', () => {
  it(
    'gives each unpinned leaf what its resolver makes of the others, whatever order they read in',
    () => {
      const t = tally();
      fc.assert(
        fc.property(plan, (leaves) => {
          const schema = f.schema(
            own(
              leaves.map((l) => {
                const node = f.number(l.pinned);
                const reads = l.reads;
                return [
                  l.key,
                  reads === null
                    ? node.auto()
                    : node.auto((c) => 1 + reads.reduce((sum, d) => sum + read(c, d), 0)),
                ] as const;
              }),
            ),
          );
          const resolved = resolveConfigSchema(schema);
          const config = schema.defaults();
          const autoPaths = new Set(leaves.filter((l) => l.auto).map((l) => l.key));
          const want = expected(leaves);
          if (want === 'cycle') {
            t.count('cycle');
            expect(() => resolveAutoConfig(resolved, config, autoPaths)).toThrow(/cycle/);
            return;
          }
          const out = resolveAutoConfig(resolved, config, autoPaths) as Record<string, unknown>;
          expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
          for (const l of leaves) {
            const v = want.get(l.key);
            if (v === undefined) {
              t.count('dropped');
              expect(Object.hasOwn(out, l.key)).toBe(false);
            } else {
              t.count(l.auto ? 'resolved' : 'pinned');
              expect(valueAtPath(out, l.key)).toBe(v);
            }
          }
          if (leaves.some((l) => l.auto && l.reads?.some((d) => autoPaths.has(d))))
            t.count('read another auto leaf');
        }),
        runs(RUNS),
      );
      for (const what of ['cycle', 'dropped', 'resolved', 'pinned', 'read another auto leaf'])
        t.atLeast(what, 30);
    },
    timeoutFor(RUNS, 5),
  );
});

describe('applyConfigWrite', () => {
  it(
    'unpins a path written auto and pins one written a value, writing nothing for auto',
    () => {
      const writes = fc.array(
        fc.tuple(
          fc.constantFrom('a', 'b', 'g.c'),
          fc.oneof(fc.integer({ min: 0, max: 3 }), fc.constant(auto)),
        ),
        { maxLength: 12 },
      );
      fc.assert(
        fc.property(writes, (list) => {
          let config: Record<string, unknown> = { a: 0, b: 0, g: { c: 0 } };
          let autoPaths: readonly string[] = [];
          const model = new Map<string, number>([
            ['a', 0],
            ['b', 0],
            ['g.c', 0],
          ]);
          const unpinned = new Set<string>();
          for (const [path, value] of list) {
            ({ config, autoPaths } = applyConfigWrite(config, autoPaths, path, value));
            if (value === auto) unpinned.add(path);
            else {
              unpinned.delete(path);
              model.set(path, value);
            }
            expect(new Set(autoPaths)).toEqual(unpinned);
            expect(autoPaths.length).toBe(unpinned.size);
            for (const [p, v] of model) expect(valueAtPath(config, p)).toBe(v);
          }
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 2),
  );
});
