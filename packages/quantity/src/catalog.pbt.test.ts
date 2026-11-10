import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { catalogUnit, catalogUnits, registerUnit, unitSpellings, unitSymbol, withUnit, type CatalogUnit, type UnitDefinition } from './catalog';
import { withSpellings } from './number';
import { runs, timeoutFor } from './pbt.fixture';

const RUNS = runs(150);
const TIMEOUT = timeoutFor(150, 2);

/** Keys that collide with the built-ins and with each other. */
const key = fc.constantFrom('in', 'ft', '"', 'deg', 'furlong', 'fur', 'hand', 'hh', 'meter', 'm', 'x', 'kB', 'KB');

const def: fc.Arbitrary<UnitDefinition> = fc.record({
  name: fc.constantFrom('furlong', 'hand', 'inch', 'meter', 'cubit', 'degree'),
  symbol: fc.oneof(key, fc.record({ text: key, attaches: fc.boolean(), aliases: fc.array(key, { maxLength: 2 }) })),
  compact: fc.option(fc.record({ text: key, attaches: fc.boolean(), aliases: fc.array(key, { maxLength: 2 }) }), { nil: undefined }),
}).map(({ name, symbol, compact }) => (compact === undefined ? { name, symbol } : { name, symbol, compact }));

const keysOf = (d: UnitDefinition): string[] => {
  const form = (f: UnitDefinition['symbol']) => (typeof f === 'string' ? [f] : [f.text, ...(f.aliases ?? [])]);
  return [d.name, ...form(d.symbol), ...(d.compact === undefined ? [] : form(d.compact))];
};

const BUILTIN_KEYS = ['in', 'ft', '"', 'deg', 'meter', 'm', 'kB', 'KB', 'furlong', 'hand', 'x', 'fur', 'hh'];
const builtin = new Map(BUILTIN_KEYS.map((k) => [k, catalogUnit(k)]));

describe('the unit catalog, property', () => {
  it('finds each key under the latest unit registered for it, and takes a unit back out cleanly in any order', () => {
    const op = fc.oneof(
      def.map((d) => ({ kind: 'add' as const, d })),
      fc.nat().map((n) => ({ kind: 'remove' as const, n })),
    );
    const tally = { shadowed: 0, restored: 0 };
    fc.assert(fc.property(fc.array(op, { minLength: 1, maxLength: 12 }), (ops) => {
      const model: { d: UnitDefinition; off: () => void }[] = [];
      try {
        for (const o of ops) {
          if (o.kind === 'add') {
            const off = registerUnit(o.d);
            model.push({ d: o.d, off });
          } else if (model.length > 0) {
            const [gone] = model.splice(o.n % model.length, 1);
            gone!.off();
            gone!.off();
            tally.restored++;
          }
          for (const k of BUILTIN_KEYS) {
            const owner = [...model].reverse().find((m) => keysOf(m.d).includes(k));
            const got = catalogUnit(k);
            if (owner) {
              tally.shadowed++;
              expect(got?.name, k).toBe(owner.d.name);
            } else expect(got, k).toBe(builtin.get(k));
          }
          const names = catalogUnits().map((u) => u.name);
          expect(new Set(names).size, 'one entry per name').toBe(names.length);
        }
      } finally {
        for (const m of model) m.off();
      }
      for (const k of BUILTIN_KEYS) expect(catalogUnit(k)).toBe(builtin.get(k));
    }), RUNS);
    expect(tally.shadowed).toBeGreaterThan(0);
    expect(tally.restored).toBeGreaterThan(0);
  }, TIMEOUT);

  it('writes every spelling of a unit as one of its own forms, and finds the unit again from it', () => {
    const units = catalogUnits();
    const spellings = units.flatMap((u: CatalogUnit) => unitSpellings(u.symbol.text).map((s) => [u, s] as const));
    fc.assert(fc.property(fc.constantFrom(...spellings), fc.boolean(), fc.boolean(), ([u, s], compact, space) => {
      expect(catalogUnit(s)?.name, s).toBe(u.name);
      const form = unitSymbol(s, { compact });
      expect([u.symbol.text, u.compact?.text]).toContain(form.text);
      expect(unitSpellings(form.text)).toContain(s);
      const text = withUnit('12', s, { compact, space });
      expect(text).toBe(`12${space && !form.attaches ? ' ' : ''}${form.text}`);
      // A reader handed one spelling accepts every other, at the same entry.
      const table = withSpellings({ [s]: 3 });
      for (const other of unitSpellings(s)) expect(table[other], other).toBe(3);
    }), RUNS);
  });
});
