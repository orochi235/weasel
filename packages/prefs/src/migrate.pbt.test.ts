import fc from 'fast-check';
import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import { VERSION_RECORD } from './helpers';
import { runPrefsMigrations, type PrefsMigration } from './migrate';
import { runs, tally, timeoutFor } from './pbt.fixture';

/** One stored record: its value, and the version it is stamped with, or none. */
interface Rec { name: string; value: string; at: number | undefined }
interface Case {
  target: number;
  version: unknown;
  records: Rec[];
  /** Per migration: the records it deletes, whether it adds one, and whether it throws. */
  steps: { drops: string[]; adds: boolean; throws: boolean }[];
}

const NAMES = ['r0', 'r1', 'r2', 'r3'];

const aCase: fc.Arbitrary<Case> = fc.integer({ min: 0, max: 4 }).chain((target) => fc.record({
  target: fc.constant(target),
  version: fc.oneof(
    { weight: 6, arbitrary: fc.integer({ min: 0, max: target + 1 }) },
    { weight: 2, arbitrary: fc.constant(undefined) },
    { weight: 1, arbitrary: fc.constantFrom(-1, 1.5, 'two', null) },
  ),
  records: fc.uniqueArray(
    fc.record({ name: fc.constantFrom(...NAMES), value: fc.constantFrom('x', 'y'), at: fc.option(fc.integer({ min: 0, max: target + 1 }), { nil: undefined, freq: 3 }) }),
    { maxLength: 4, selector: (r) => r.name },
  ),
  steps: fc.array(
    fc.record({ drops: fc.subarray(NAMES, { maxLength: 2 }), adds: fc.boolean(), throws: fc.integer({ min: 0, max: 9 }).map((n) => n === 0) }),
    { minLength: target, maxLength: target },
  ),
}));

const migrationsOf = (c: Case): PrefsMigration[] => c.steps.map((s, i) => (records) => {
  if (s.throws) throw new Error(`step ${i}`);
  for (const [name, value] of records) records.set(name, `${value as string}>${i}`);
  for (const name of s.drops) records.delete(name);
  if (s.adds) records.set(`new${i}`, 'n');
});

/** What each record holds after the run, and its stamp, by the model; `null` when the run writes nothing. */
function expected(c: Case): Map<string, { value: string; at: number }> | null {
  const isVersion = typeof c.version === 'number' && Number.isInteger(c.version) && c.version >= 0;
  if (c.version !== undefined && !isVersion) return null;
  const stored = (c.version as number | undefined) ?? 0;
  const held = c.records.map((r) => ({ ...r, at: r.at ?? Math.min(stored, c.target) }));
  if (Math.max(stored, ...held.map((r) => r.at)) > c.target) return null;
  const out = new Map<string, { value: string; at: number }>();
  const behind = held.filter((r) => r.at < c.target);
  for (const r of held) if (r.at >= c.target) out.set(r.name, { value: r.value, at: c.target });
  const least = Math.min(c.target, ...behind.map((r) => r.at));
  const live = new Map<string, { value: string; at: number }>(behind.map((r) => [r.name, { value: r.value, at: r.at }]));
  for (let v = least; v < c.target; v++) {
    const s = c.steps[v]!;
    if (s.throws) return null;
    const due = [...live].filter(([, r]) => r.at <= v).map(([name]) => name);
    for (const name of due) {
      const r = live.get(name)!;
      r.value = `${r.value}>${v}`;
      r.at = v + 1;
    }
    for (const name of s.drops) if (due.includes(name)) live.delete(name);
    if (s.adds) live.set(`new${v}`, { value: 'n', at: v + 1 });
  }
  for (const [name, r] of live) out.set(name, { value: r.value, at: c.target });
  return out;
}

describe('runPrefsMigrations, properties', () => {
  it('brings every record to the current version from its own stamp, or writes nothing', () => {
    const t = tally();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fc.assert(
      fc.property(aCase, (c) => {
        const initial: [string, unknown][] = c.records.map((r) => [r.name, r.at === undefined ? r.value : { $at: r.at, value: r.value }]);
        if (c.version !== undefined) initial.push([VERSION_RECORD, c.version]);
        const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial });
        const before = cache.entries();
        runPrefsMigrations(cache, migrationsOf(c));
        const want = expected(c);
        if (want === null) {
          t.count('read-only');
          expect(cache.writable).toBe(false);
          expect(cache.entries()).toEqual(before);
          return;
        }
        t.count(c.records.some((r) => (r.at ?? c.version ?? 0) as number < c.target) ? 'migrated' : 'current');
        expect(cache.writable).toBe(true);
        expect(cache.get(VERSION_RECORD)).toBe(c.version === undefined && c.target === 0 ? undefined : c.target);
        const got = new Map(cache.entries().filter(([n]) => n !== VERSION_RECORD).map(([n, rec]) => [n, rec]));
        expect(got).toEqual(new Map([...want].map(([n, r]) => [n, { $at: r.at, value: r.value }])));
        expect(runPrefsMigrations(cache, migrationsOf(c))).toBe(false);
      }),
      runs(400),
    );
    warn.mockRestore();
    t.atLeast('read-only', 20);
    t.atLeast('migrated', 50);
    t.atLeast('current', 10);
  }, timeoutFor(400, 5));
});
