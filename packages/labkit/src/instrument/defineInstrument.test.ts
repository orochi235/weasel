import { describe, expect, expectTypeOf, it } from 'vitest';
import { f } from '../config/builder';
import type { ConfigOf } from '../config/types';
import { defaultConfigOf, defineInstrument } from './defineInstrument';
import type { Instrument } from './types';

describe('defineInstrument', () => {
  it('returns the spec by reference', () => {
    const spec: Instrument<{ n: number }, { x: number }> = {
      name: 'Test',
      defaultConfig: () => ({ x: 1 }),
      initialState: (c) => ({ n: c.x }),
      render: () => null,
    };
    expect(defineInstrument(spec)).toBe(spec);
  });

  it('infers TS and TC from the literal', () => {
    const inst = defineInstrument({
      name: 'Inferred',
      defaultConfig: () => ({ flag: true }),
      initialState: (c) => ({ count: c.flag ? 1 : 0 }),
      render: () => null,
    });
    expectTypeOf(defaultConfigOf(inst)).toEqualTypeOf<{ flag: boolean }>();
    expectTypeOf(inst.initialState({ flag: true })).toEqualTypeOf<{ count: number }>();
  });

  it('infers TC from the schema', () => {
    const config = f.schema({ showGrid: f.boolean(true), mode: f.enum('fast', ['fast', 'slow']) });
    const inst = defineInstrument<{ n: number }, ConfigOf<typeof config>>({
      name: 'Schema',
      config,
      initialState: () => ({ n: 0 }),
      render: () => null,
    });
    expectTypeOf(defaultConfigOf(inst)).toEqualTypeOf<{
      showGrid: boolean;
      mode: 'fast' | 'slow';
    }>();
  });
});

describe('defaultConfigOf', () => {
  it("reads a builder schema's defaults", () => {
    const inst = defineInstrument({
      name: 'Schema',
      config: f.schema({ showGrid: f.boolean(true), cellSize: f.number(20) }),
      initialState: () => ({}),
      render: () => null,
    });
    expect(defaultConfigOf(inst)).toEqual({ showGrid: true, cellSize: 20 });
  });

  it('prefers an explicit defaultConfig to the schema beside it', () => {
    const inst = defineInstrument({
      name: 'Both',
      config: f.schema({ a: f.number(1) }),
      defaultConfig: () => ({ a: 99 }),
      initialState: () => ({}),
      render: () => null,
    });
    expect(defaultConfigOf(inst)).toEqual({ a: 99 });
  });

  it('is an empty config for an instrument declaring neither', () => {
    const inst = defineInstrument({ name: 'Bare', initialState: () => ({}), render: () => null });
    expect(defaultConfigOf(inst)).toEqual({});
  });
});
