/**
 * Property tests of `mergeChain` over chains of pin-only definitions: a merged pin reads, at every selection, the
 * child's value where it has one and the parent's merged value where it leaves the axis value out; and any
 * `extends` graph, loops and missing names included, merges or is refused with an error, never a stack overflow.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { enumerateSelections, isByAxis, pick, type AxisDefs, type Varying } from '../axes';
import type { PinValue, ThemeDefinition } from '../definition';
import { runs, tally, tokenName } from '../pbt.fixture';
import { mergeChain } from './merge';

const RUNS = 300;

const AXES: AxisDefs = {
  mode: { default: 'dark', values: { dark: {}, light: {}, constructor: {} } },
  density: { default: 'a', values: { a: {}, toString: {} } },
};

const leaf: fc.Arbitrary<PinValue> = fc.constantFrom('#ff0000', '4px', 3, '{fg}');

/** A pin plain or varying by one axis at its top, naming some of that axis' values. */
const pin: fc.Arbitrary<Varying<PinValue>> = fc.oneof(
  leaf,
  fc.constantFrom(...Object.keys(AXES)).chain((axis) =>
    fc.subarray(Object.keys(AXES[axis]!.values)).chain((vs) =>
      fc.tuple(...vs.map(() => leaf)).map((xs) => ({ by: axis, ...Object.fromEntries(vs.map((v, i) => [v, xs[i]])) }) as Varying<PinValue>),
    ),
  ),
);

const pins = fc.dictionary(tokenName, pin, { maxKeys: 5 });

describe('mergeChain', () => {
  it('a merged pin reads the child where it has a value and the parent where it leaves one out', () => {
    const t = tally();
    fc.assert(fc.property(pins, pins, pins, (rootPins, midPins, kidPins) => {
      const defs: Record<string, ThemeDefinition> = {
        root: { name: 'root', axes: AXES, pins: rootPins },
        mid: { name: 'mid', extends: 'root', pins: midPins },
        kid: { name: 'kid', extends: 'mid', pins: kidPins },
      };
      const lookup = (n: string) => (Object.hasOwn(defs, n) ? defs[n] : undefined);
      const merged = mergeChain(defs.kid!, lookup);
      const parent = mergeChain(defs.mid!, lookup);
      expect(Object.keys(merged.pins ?? {}).sort()).toEqual([...new Set([...Object.keys(parent.pins ?? {}), ...Object.keys(kidPins)])].sort());
      for (const sel of enumerateSelections(AXES)) {
        for (const name of Object.keys(merged.pins ?? {})) {
          const got = pick(merged.pins![name]!, sel);
          const own = Object.hasOwn(kidPins, name) ? pick(kidPins[name]!, sel) : { ok: false as const };
          const above = Object.hasOwn(parent.pins ?? {}, name) ? pick(parent.pins![name]!, sel) : { ok: false as const };
          if (own.ok) t.count('own');
          else if (above.ok && Object.hasOwn(kidPins, name) && isByAxis(kidPins[name])) t.count('filled');
          const want = own.ok ? own : Object.hasOwn(kidPins, name) && !isByAxis(kidPins[name]) ? own : above;
          if (want.ok) expect(got).toEqual(want);
          else expect(got.ok).toBe(false);
        }
      }
    }), runs(RUNS));
    t.atLeast('own', 300);
    t.atLeast('filled', 100);
  });

  it('merges any extends graph or refuses it with an error', () => {
    const t = tally();
    const names = ['a', 'b', 'c', 'd'];
    const graph = fc.record({ a: fc.constantFrom(...names, 'nope', null), b: fc.constantFrom(...names, 'nope', null), c: fc.constantFrom(...names, null), d: fc.constantFrom(...names, null) });
    fc.assert(fc.property(graph, fc.constantFrom(...names), (ext, start) => {
      const defs = Object.fromEntries(names.map((n) => [n, { name: n, extends: ext[n as keyof typeof ext], pins: { [n]: '1px' } }])) as Record<string, ThemeDefinition>;
      const lookup = (n: string) => (Object.hasOwn(defs, n) ? defs[n] : undefined);
      try {
        const merged = mergeChain(defs[start]!, lookup);
        t.count('merged');
        expect(merged.name).toBe(start);
      } catch (e) {
        expect(e).not.toBeInstanceOf(RangeError);
        const msg = (e as Error).message;
        t.count(msg.includes('cycle') ? 'cycle' : 'missing');
        expect(msg).toMatch(/extends cycle at theme|which is not defined/);
      }
    }), runs(RUNS));
    t.atLeast('merged', 50);
    t.atLeast('cycle', 50);
    t.atLeast('missing', 15);
  });
});
