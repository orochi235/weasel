import { describe, expect, expectTypeOf, it } from 'vitest';
import { f } from '../config/builder';
import type { ConfigOf } from '../config/types';
import { defineInstrument } from './defineInstrument';
import type { Instrument } from './types';

describe('defineInstrument', () => {
  it('returns a legacy spec by reference', () => {
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

  it('synthesizes defaultConfig from a builder schema', () => {
    const inst = defineInstrument({
      name: 'Schema',
      config: f.schema({ showGrid: f.boolean(true), cellSize: f.number(20) }),
      initialState: () => ({}),
      render: () => null,
    });
    expect(inst.defaultConfig()).toEqual({ showGrid: true, cellSize: 20 });
  });

  it('infers TC from the schema', () => {
    const config = f.schema({ showGrid: f.boolean(true), mode: f.enum('fast', ['fast', 'slow']) });
    const inst = defineInstrument<{ n: number }, ConfigOf<typeof config>>({
      name: 'Schema',
      config,
      initialState: () => ({ n: 0 }),
      render: () => null,
    });
    expectTypeOf(inst.defaultConfig()).toEqualTypeOf<{
      showGrid: boolean;
      mode: 'fast' | 'slow';
    }>();
  });

  it('leaves an explicit defaultConfig alone even alongside a schema', () => {
    const inst = defineInstrument({
      name: 'Both',
      config: f.schema({ a: f.number(1) }),
      defaultConfig: () => ({ a: 99 }),
      initialState: () => ({}),
      render: () => null,
    });
    expect(inst.defaultConfig()).toEqual({ a: 99 });
  });
});
