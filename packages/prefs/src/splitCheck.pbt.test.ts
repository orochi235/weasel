import fc from 'fast-check';
import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from './groups';
import { prefLeaves } from './helpers';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { PREF_ELSE, type PrefScope } from './scope';
import type { PrefLeaf } from './schema';
import type { PrefScopeSpec } from './scopeSpec';
import { checkPrefSplits, prefSelectors, type PrefSplitProblem } from './splitCheck';
import { createPrefsStore } from './store';

const OPTIONS = ['x', 'y', 'z'];
const options = OPTIONS.map((value) => ({ value, label: value }));
const enumOf = (extra: Record<string, unknown> = {}): PrefLeaf => ({ kind: 'enum', name: 'E', description: '', default: 'x', options, ...extra }) as PrefLeaf;

/** What a selector path holds, and whether a split by it is refused. */
const SELECTORS: Record<string, { leaf?: PrefLeaf; refused?: PrefSplitProblem['code'] }> = {
  s0: { leaf: enumOf() },
  s1: { leaf: enumOf() },
  bad_encoded: { leaf: enumOf({ encoding: { read: () => 'x', write: () => 1 } }), refused: 'encoded' },
  bad_clearable: { leaf: enumOf({ clearable: true, default: undefined }), refused: 'clearable' },
  bad_split: { leaf: enumOf({ scopes: [{ selector: 's0' }] }), refused: 'split' },
  bad_number: { leaf: { kind: 'number', name: 'N', description: '', default: 0 }, refused: 'not-enum' },
  adm: {},
  missing: { refused: 'no-leaf' },
};
const PATHS = Object.keys(SELECTORS);

const spec: fc.Arbitrary<PrefScopeSpec> = fc.record({
  selector: fc.constantFrom(...PATHS),
  overrides: fc.option(fc.oneof(fc.subarray([...OPTIONS, 'w']), fc.dictionary(fc.constantFrom(...OPTIONS, 'w'), fc.integer({ min: 0, max: 100 }), { maxKeys: 2 })), { nil: undefined, freq: 2 }),
}, { requiredKeys: ['selector'] });

const scopeOf = (by: string[], depth = 0): fc.Arbitrary<PrefScope> =>
  fc.record({
    $by: fc.constantFrom(...by),
    $in: fc.dictionary(fc.constantFrom(...OPTIONS), depth < 1 ? fc.oneof(fc.integer({ min: 0, max: 100 }), scopeOf(by, depth + 1)) : fc.integer({ min: 0, max: 100 }), { maxKeys: 2 }),
    [PREF_ELSE]: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  }).map((s) => (s[PREF_ELSE] === undefined ? { $by: s.$by, $in: s.$in } : s) as PrefScope);

const pref = fc.record({
  scopes: fc.array(spec, { maxLength: 3 }),
  defaultScope: fc.option(scopeOf(PATHS), { nil: undefined, freq: 3 }),
  valueless: fc.integer({ min: 0, max: 9 }).map((n) => n === 0),
}).map(({ scopes, defaultScope, valueless }): PrefLeaf => ({
  ...(valueless ? { kind: 'label', default: undefined } : { kind: 'number', default: 4, min: 0, max: 100 }),
  name: 'P', description: '',
  ...(scopes.length ? { scopes } : {}),
  ...(defaultScope ? { defaultScope } : {}),
}) as PrefLeaf);

const schemaArb = fc.record({ p0: pref, p1: pref, admitsAdm: fc.boolean(), admitsLeaf: fc.integer({ min: 0, max: 9 }).map((n) => n === 0) })
  .map(({ p0, p1, admitsAdm, admitsLeaf }): PrefGroup => ({
    name: 'S',
    ...(admitsAdm || admitsLeaf ? { admits: [...(admitsAdm ? ['adm'] : []), ...(admitsLeaf ? ['s0'] : [])] } : {}),
    children: { ...Object.fromEntries(PATHS.filter((p) => SELECTORS[p]!.leaf).map((p) => [p, SELECTORS[p]!.leaf!])), p0, p1 },
  }));

const selectionsOf = (selectors: readonly string[]): fc.Arbitrary<Record<string, string>> =>
  fc.tuple(...selectors.map((s) => fc.constantFrom(...OPTIONS).map((o) => [s, o] as const))).map((pairs) => Object.fromEntries(pairs));

describe('checkPrefSplits, properties', () => {
  it('names each refused selector with its own code, and keeps only the plain enums as selectors', () => {
    const t = tally();
    fc.assert(
      fc.property(schemaArb, (schema) => {
        const problems = checkPrefSplits(schema);
        for (const p of problems) t.count(p.code);
        const leaves = prefLeaves(schema);
        const kept = prefSelectors(leaves);
        for (const path of kept.keys()) expect(SELECTORS[path]!.refused).toBeUndefined();
        for (const at of ['p0', 'p1']) {
          const leaf = leaves.get(at)!;
          if (leaf.kind === 'label') continue;
          for (const { selector } of leaf.scopes ?? []) {
            const refused = SELECTORS[selector]!.refused;
            if (selector === 'adm' && !schema.admits?.includes('adm')) {
              expect(problems).toContainEqual(expect.objectContaining({ code: 'no-leaf', at, path: 'adm' }));
            } else if (refused && (leaf.scopes ?? []).filter((s) => s.selector === selector).length === 1) {
              expect(problems).toContainEqual(expect.objectContaining({ code: refused, at, path: selector }));
            }
            if (!refused && selector !== 'adm') expect(kept.get(selector)).toEqual(OPTIONS);
          }
        }
      }),
      runs(400),
    );
    for (const code of ['valueless', 'no-leaf', 'not-enum', 'encoded', 'clearable', 'split', 'twice', 'default', 'per', 'admits']) t.atLeast(code, 5);
  }, timeoutFor(400, 3));

  it('lets a store over a schema it passes warn of nothing, read each split value as it was written, and read it the same once stored', () => {
    const t = tally();
    const clean = schemaArb.filter((schema) => checkPrefSplits(schema).length === 0);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fc.assert(
      fc.property(clean, fc.array(fc.tuple(fc.constantFrom('p0', 'p1'), selectionsOf(['s0', 's1', 'adm']), fc.integer({ min: 0, max: 100 })), { minLength: 1, maxLength: 8 }), (schema, writes) => {
        warn.mockClear();
        const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.' });
        const store = createPrefsStore(schema, cache);
        expect(warn).not.toHaveBeenCalled();
        for (const [path, at, v] of writes) {
          const leaf = prefLeaves(schema).get(path)!;
          if (leaf.kind === 'label') continue;
          const split = !!leaf.scopes?.length;
          t.count(split ? 'split' : 'plain');
          store.set(path as never, v as never, { at });
          expect(store.get(path as never, { at })).toBe(v);
        }
        const initial = cache.entries().map(([name, record]): [string, unknown] => [name, JSON.parse(JSON.stringify(record))]);
        const again = createPrefsStore(schema, createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial }));
        for (const [path, at] of writes) expect(again.get(path as never, { at })).toBe(store.get(path as never, { at }));
      }),
      runs(300),
    );
    warn.mockRestore();
    t.atLeast('split', 100);
    t.atLeast('plain', 20);
  }, timeoutFor(300, 10));
});
