/**
 * Property tests of the rule chain a leaf is inferred through: `applyRules` fills gaps and never overwrites, so the
 * author's annotations beat every rule and an earlier rule beats a later one; and `titleCase`, the label a key
 * gets, is a fixed point of itself.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { applyRules, titleCase } from './rules';
import type { ConfigRule, LeafPatch } from './types';

const RUNS = 300;
const FIELDS = ['kind', 'name', 'description', 'control', 'min'] as const;

const patch = fc.record(
  {
    kind: fc.constantFrom('number', 'string', undefined),
    name: fc.constantFrom('A', 'B', undefined),
    description: fc.constantFrom('', 'd', undefined),
    control: fc.constantFrom('slider', undefined),
    min: fc.constantFrom(0, 1, undefined),
  },
  { requiredKeys: [] },
) as fc.Arbitrary<Record<string, unknown>>;

describe('applyRules', () => {
  it(
    'settles each field from the seed, else from the first rule to say it, and shows each rule what is settled',
    () => {
      const t = tally();
      fc.assert(
        fc.property(
          patch,
          fc.array(fc.option(patch, { nil: null }), { maxLength: 5 }),
          (seed, said) => {
            const seen: Record<string, unknown>[] = [];
            const rules: ConfigRule[] = said.map((p) => (ctx) => {
              seen.push({ ...ctx.leaf });
              return p as LeafPatch | null;
            });
            const out = applyRules(seed as LeafPatch, { key: 'k', path: 'k', default: 0 }, rules);
            const settled: Record<string, unknown> = {};
            for (const f of FIELDS) if (seed[f] !== undefined) settled[f] = seed[f];
            said.forEach((p, i) => {
              expect(seen[i]).toEqual(expect.objectContaining(settled));
              if (p === null) return;
              for (const f of FIELDS) {
                if (p[f] === undefined || settled[f] !== undefined) continue;
                settled[f] = p[f];
                t.count('a rule filled a gap');
              }
              if (
                FIELDS.some((f) => seed[f] !== undefined && p[f] !== undefined && p[f] !== seed[f])
              )
                t.count('the seed beat a rule');
            });
            for (const f of FIELDS) expect((out as Record<string, unknown>)[f]).toBe(settled[f]);
          },
        ),
        runs(RUNS),
      );
      t.atLeast('a rule filled a gap', 100);
      t.atLeast('the seed beat a rule', 50);
    },
    timeoutFor(RUNS, 1),
  );
});

describe('titleCase', () => {
  it(
    'labels a key with one capital and no separators, and leaves its own label alone',
    () => {
      const key = fc.stringMatching(/^[a-zA-Z0-9_-]{0,12}$/);
      fc.assert(
        fc.property(key, (k) => {
          const label = titleCase(k);
          expect(titleCase(label)).toBe(label);
          expect(label).not.toMatch(/[_-]/);
          expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
          expect(label.replace(/ /g, '').toLowerCase()).toBe(k.replace(/[_-]/g, '').toLowerCase());
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );
});
