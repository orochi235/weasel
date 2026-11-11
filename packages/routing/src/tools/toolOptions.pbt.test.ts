/**
 * Property tests of tool options: a size or strength step at any magnitude, subnormal to near the double range,
 * moves the way it is asked, stays in bounds and finite, and comes back; and options keyed by any name,
 * `Object.prototype`'s member names among them, read and write their own slots.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { PrefNumber } from '@weasel-js/prefs';
import { runs, tally } from '../pbt.fixture';
import {
  createToolOptionValues, heldToolOptions, keepToolOptions, setToolOption, steppedOption, toolOptionParams,
  type ToolOptions, type ToolOptionStep,
} from './toolOptions';

/** A positive double of any magnitude, subnormals among them. */
const magnitude = fc.oneof(
  fc.double({ min: -320, max: 300, noNaN: true }).map((e) => 10 ** e).filter((v) => v > 0 && Number.isFinite(v)),
  fc.constantFrom(Number.MIN_VALUE, 1e-310, 1e-7, 0.5, 1, 3, 1e6, 1e21, 1e300, Number.MAX_VALUE / 4),
);
const bound = fc.option(magnitude, { nil: undefined, freq: 2 });

interface Case { leaf: PrefNumber; value: number; step: ToolOptionStep; dir: 1 | -1 }

const stepCase: fc.Arbitrary<Case> = fc.record({
  lo: bound, hi: bound, at: fc.double({ min: 0, max: 1, noNaN: true }), value: magnitude,
  times: fc.option(fc.double({ min: 1.01, max: 10, noNaN: true }), { nil: undefined }),
  plus: fc.option(magnitude, { nil: undefined }),
  dir: fc.constantFrom<1 | -1>(1, -1),
}).map(({ lo, hi, value, times, plus, dir }) => {
  const [min, max] = lo !== undefined && hi !== undefined && lo > hi ? [hi, lo] : [lo, hi];
  const v = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
  const leaf: PrefNumber = {
    kind: 'number', name: 'S', description: '', default: v,
    ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}),
  };
  const step: ToolOptionStep = { option: 's', ...(times !== undefined ? { times } : plus !== undefined ? { plus } : {}) };
  return { leaf, value: v, step, dir };
});

describe('steppedOption', () => {
  it('moves a value one way, short of the bound it heads for, and never out of bounds or to an infinity', () => {
    const t = tally();
    fc.assert(fc.property(stepCase, ({ leaf, value, step, dir }) => {
      const next = steppedOption(leaf, value, step, dir);
      expect(Number.isFinite(next), `${value} → ${next}`).toBe(true);
      if (leaf.min !== undefined) expect(next).toBeGreaterThanOrEqual(leaf.min);
      if (leaf.max !== undefined) expect(next).toBeLessThanOrEqual(leaf.max);
      const end = dir === 1 ? leaf.max : leaf.min;
      if (value === end) { t.hit('at its end'); return; }
      const raw = step.times !== undefined ? value * step.times ** dir : value + dir * (step.plus ?? 1);
      // A move too small for a double to hold leaves nothing to step.
      if (raw === value) { expect(next).toBe(value); t.hit('unrepresentable'); return; }
      if (dir === 1) expect(next, `${value} up`).toBeGreaterThan(value);
      else expect(next, `${value} down`).toBeLessThan(value);
      t.hit(value < 1e-6 ? 'tiny' : value > 1e21 ? 'huge' : 'plain');
    }), runs(1_000));
    t.expectHit('at its end', 'unrepresentable', 'tiny', 'huge', 'plain');
  });

  it('comes back from a step on a grid it did not clamp on', () => {
    fc.assert(fc.property(
      fc.integer({ min: -6, max: 6 }), fc.integer({ min: 1, max: 9 }), fc.integer({ min: -10_000, max: 10_000 }),
      fc.integer({ min: 1, max: 5 }), fc.constantFrom<1 | -1>(1, -1),
      (exp, mant, index, k, dir) => {
        const grid = mant * 10 ** exp;
        const leaf: PrefNumber = { kind: 'number', name: 'S', description: '', default: 0, step: grid };
        const value = Number((index * grid).toPrecision(12));
        const step = { option: 's', plus: Number((k * grid).toPrecision(12)) };
        const there = steppedOption(leaf, value, step, dir);
        expect(steppedOption(leaf, there, step, dir === 1 ? -1 : 1)).toBe(value);
      },
    ), runs(1_000));
  });
});

const PROTO_KEYS = ['__proto__', 'toString', 'constructor', 'valueOf', 'hasOwnProperty'];
const optionKey = fc.oneof(fc.constantFrom(...PROTO_KEYS, 'size'), fc.string({ minLength: 1, maxLength: 3 }));

function optionsOf(keys: readonly string[], shared: ReadonlySet<string>): ToolOptions {
  const children: Record<string, PrefNumber> = {};
  for (const [i, key] of keys.entries()) {
    Object.defineProperty(children, key, {
      value: { kind: 'number', name: key, description: '', default: i, min: -100, max: 100 },
      enumerable: true, writable: true, configurable: true,
    });
  }
  const share: Record<string, string> = {};
  for (const key of shared) Object.defineProperty(share, key, { value: `s:${key}`, enumerable: true });
  return { actionId: 'a', prefs: { name: 'T', description: '', children }, share };
}

describe('tool option values', () => {
  it('read each option from its own slot, over its default, whatever it is named', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.uniqueArray(optionKey, { minLength: 1, maxLength: 6 }).chain((keys) => fc.tuple(
        fc.constant(keys), fc.subarray(keys),
        fc.array(fc.tuple(fc.constantFrom(...keys), fc.integer({ min: -100, max: 100 })), { maxLength: 12 }),
      )),
      ([keys, sharedKeys, writes]) => {
        const options = optionsOf(keys, new Set(sharedKeys));
        const values = createToolOptionValues();
        const model = new Map<string, number>();
        for (const [key, v] of writes) {
          setToolOption('tool', options, values, key, v);
          model.set(key, v);
          if (PROTO_KEYS.includes(key)) t.hit('prototype key');
        }
        const params = toolOptionParams('tool', options, values);
        const held = heldToolOptions('tool', options, values);
        expect(Object.getPrototypeOf(params)).toBe(Object.prototype);
        expect(Object.keys(params).sort()).toEqual([...keys].sort());
        expect(Object.keys(held).sort()).toEqual([...model.keys()].sort());
        for (const [i, key] of keys.entries()) {
          expect(Object.getOwnPropertyDescriptor(params, key)?.value).toBe(model.get(key) ?? i);
        }
        // Keeping what it already holds writes nothing; keeping a new value writes it.
        let writesSeen = 0;
        const off = values.subscribe(() => { writesSeen++; });
        keepToolOptions('tool', options, values, params);
        expect(writesSeen).toBe(0);
        const key = keys[0]!;
        const fresh: Record<string, unknown> = {};
        Object.defineProperty(fresh, key, { value: (model.get(key) ?? keys.indexOf(key)) === 100 ? 99 : 100, enumerable: true });
        keepToolOptions('tool', options, values, fresh);
        expect(Object.getOwnPropertyDescriptor(toolOptionParams('tool', options, values), key)?.value)
          .toBe(Object.getOwnPropertyDescriptor(fresh, key)?.value);
        off();
      },
    ), runs(300));
    t.expectHit('prototype key');
  });
});
