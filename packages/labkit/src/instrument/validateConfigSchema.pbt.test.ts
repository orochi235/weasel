/**
 * Property of `validateConfigSchema` against a reading of each field's own constraints: a schema is valid exactly
 * when no key is empty or named twice, no label is empty, every slider and number holds a finite default inside a
 * range that is one, and every select's default is among its distinct options.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ConfigField } from '../controls/types';
import { KEYS, runs, tally, timeoutFor } from '../pbt.fixture';
import { validateConfigSchema } from './validateConfigSchema';

const RUNS = 300;

const num = fc.oneof(
  fc.integer({ min: -3, max: 3 }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
);
const key = fc.constantFrom(...KEYS, '');
const label = fc.constantFrom('Size', '');
const base = { key, label };

const field: fc.Arbitrary<ConfigField> = fc.oneof(
  fc.record({ ...base, type: fc.constant('slider' as const), default: num, min: num, max: num }),
  fc.record(
    { ...base, type: fc.constant('number' as const), default: num, min: num, max: num },
    { requiredKeys: ['key', 'label', 'type', 'default'] },
  ),
  fc.record({ ...base, type: fc.constant('checkbox' as const), default: fc.boolean() }),
  fc.record({
    ...base,
    type: fc.constant('select' as const),
    default: fc.constantFrom('x', 'y'),
    options: fc.array(
      fc.record({ value: fc.constantFrom('x', 'y', 'z', 'toString'), label: fc.constant('X') }),
      { maxLength: 3 },
    ),
  }),
);

/** Whether `f`'s own constraints hold, read off the field directly. */
function holds(f: ConfigField): boolean {
  if (f.type === 'slider')
    return (
      Number.isFinite(f.default) &&
      Number.isFinite(f.min) &&
      Number.isFinite(f.max) &&
      f.min < f.max &&
      f.min <= f.default &&
      f.default <= f.max
    );
  if (f.type === 'number') {
    const min = f.min ?? -Infinity;
    const max = f.max ?? Infinity;
    return (
      Number.isFinite(f.default) &&
      !Number.isNaN(min) &&
      !Number.isNaN(max) &&
      min <= f.default &&
      f.default <= max
    );
  }
  if (f.type === 'select') {
    const values = f.options.map((o) => o.value);
    return (
      values.length > 0 && new Set(values).size === values.length && values.includes(f.default)
    );
  }
  return true;
}

describe('validateConfigSchema', () => {
  it(
    "is valid exactly when every key is distinct and set, every label set, and every field's own constraints hold",
    () => {
      const t = tally();
      fc.assert(
        fc.property(fc.array(field, { maxLength: 4 }), (fields) => {
          const keys = fields.map((f) => f.key);
          const valid =
            keys.every((k) => k !== '') &&
            new Set(keys).size === keys.length &&
            fields.every((f) => f.label !== '' && holds(f));
          const result = validateConfigSchema(fields);
          expect(result.valid).toBe(valid);
          expect(result.valid).toBe(result.errors.length === 0);
          t.count(valid ? 'valid' : 'invalid');
          if (
            fields.some(
              (f) => (f.type === 'slider' || f.type === 'number') && !holds(f) && f.label !== '',
            )
          ) {
            t.count('a range that does not hold');
          }
        }),
        runs(RUNS),
      );
      t.atLeast('valid', RUNS / 20);
      t.atLeast('invalid', RUNS / 4);
      t.atLeast('a range that does not hold', RUNS / 10);
    },
    timeoutFor(RUNS, 1),
  );

  it('flags a number default outside its own range (shrunk)', () => {
    const r = validateConfigSchema([
      { key: 'a', label: 'Size', type: 'number', default: 0, max: -1 },
    ]);
    expect(r.errors).toEqual(['Number "a": default 0 is outside [min, max]']);
  });

  it('flags a slider whose range is not a number (shrunk)', () => {
    const r = validateConfigSchema([
      { key: 'a', label: 'Size', type: 'slider', default: 0, min: Number.NaN, max: 1 },
    ]);
    expect(r.errors).toEqual(['Slider "a": min and max must be finite numbers']);
  });
});
