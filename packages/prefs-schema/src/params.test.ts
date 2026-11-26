import { describe, expect, expectTypeOf, it } from 'vitest';
import { type ParamShape, paramDefault, paramDefaults } from './params';

const SHAPE = {
  speed: { kind: 'number', label: 'Speed', min: 1, max: 5, step: 0.5 },
  look: {
    kind: 'group',
    label: 'Look',
    params: {
      tint: { kind: 'color', default: '#336699' },
      mode: { kind: 'enum', options: ['soft', { value: 'hard', label: 'Hard' }] },
      on: { kind: 'boolean', default: true },
    },
  },
} as const satisfies ParamShape;

describe('paramDefaults', () => {
  it('reads each default, nested the way the groups are', () => {
    const values = paramDefaults(SHAPE);
    expect(values).toEqual({ speed: 1, look: { tint: '#336699', mode: 'soft', on: true } });
    expectTypeOf(values).toEqualTypeOf<{
      speed: number;
      look: { tint: string; mode: 'soft' | 'hard'; on: boolean };
    }>();
  });

  it('takes a value from `defaults` over the description’s, and leaves the rest', () => {
    expect(paramDefaults(SHAPE, { speed: 3, look: { mode: 'hard' } })).toEqual({
      speed: 3,
      look: { tint: '#336699', mode: 'hard', on: true },
    });
  });

  it('throws on a given default of the wrong type, or a choice outside the options', () => {
    expect(() => paramDefaults(SHAPE, { look: { on: 'yes' } })).toThrow(/look\.on is "yes", not a boolean/);
    expect(() => paramDefaults(SHAPE, { look: { mode: 'medium' } })).toThrow(/not one of its options/);
  });

  it('falls back by kind', () => {
    expect(paramDefault({ kind: 'number', max: 4 })).toBe(0);
    expect(paramDefault({ kind: 'boolean' })).toBe(false);
    expect(paramDefault({ kind: 'color' })).toBe('#000000');
    expect(() => paramDefault({ kind: 'enum', options: [] })).toThrow(/at least one option/);
    expect(() => paramDefault({ kind: 'slider' } as never)).toThrow(/unknown param kind "slider"/);
  });

  it('survives JSON', () => {
    const copy = JSON.parse(JSON.stringify(SHAPE)) as ParamShape;
    expect(copy).toEqual(SHAPE);
    expect(paramDefaults(copy)).toEqual(paramDefaults(SHAPE));
  });
});
