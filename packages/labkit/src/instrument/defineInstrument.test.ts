import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineInstrument } from './defineInstrument';
import type { Instrument } from './types';

describe('defineInstrument', () => {
  it('returns the same object reference passed in', () => {
    const spec: Instrument<{ n: number }, { x: number }> = {
      name: 'Test',
      defaultConfig: () => ({ x: 1 }),
      initialState: (c) => ({ n: c.x }),
      render: () => null,
    };
    const result = defineInstrument(spec);
    expect(result).toBe(spec);
  });

  it('infers TS and TC from the literal', () => {
    const inst = defineInstrument({
      name: 'Inferred',
      defaultConfig: () => ({ flag: true }),
      initialState: (c) => ({ count: c.flag ? 1 : 0 }),
      render: () => null,
    });
    expectTypeOf(inst.defaultConfig()).toEqualTypeOf<{ flag: boolean }>();
    expectTypeOf(inst.initialState({ flag: true })).toEqualTypeOf<{ count: number }>();
  });
});
