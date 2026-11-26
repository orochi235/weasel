import type { ParamShape } from '@weasel-js/prefs-schema';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { f } from './builder';
import {
  AGNEW,
  agnewByHand,
  BEAMOS,
  beamosByHand,
  MAGICSMOKE,
  MAGICSMOKE_DEFAULTS,
  magicsmokeByHand,
} from './params.fixtures';
import { resolveConfigSchema } from './resolve';
import type { ConfigOf } from './types';

const resolved = (schema: Parameters<typeof resolveConfigSchema>[0]) => resolveConfigSchema(schema);

describe('f.params', () => {
  it.each([
    ['magicsmoke', () => f.params(MAGICSMOKE, { defaults: MAGICSMOKE_DEFAULTS }), magicsmokeByHand],
    ['agnew', () => f.params(AGNEW), agnewByHand],
    ['beamos', () => f.params(BEAMOS), beamosByHand],
  ])('compiles %s to the schema its lab built by hand', (_, compiled, byHand) => {
    const schema = compiled();
    const hand = f.schema(byHand());
    expect(resolved(schema)).toEqual(resolved(hand));
    expect(schema.defaults()).toEqual(hand.defaults());
  });

  it('reads defaults back out, from the description or from `defaults`', () => {
    expect(f.params(AGNEW).defaults()).toEqual({ axis: 'y', R: 0.72, twist: 0, capped: true });
    expect(f.params(MAGICSMOKE, { defaults: MAGICSMOKE_DEFAULTS }).defaults()).toEqual(
      MAGICSMOKE_DEFAULTS,
    );
  });

  it('falls back to each kind’s default where none is given', () => {
    const schema = f.params({
      n: { kind: 'number', min: 2, max: 9 },
      bare: { kind: 'number' },
      b: { kind: 'boolean' },
      e: { kind: 'enum', options: [{ value: 'lo', label: 'Low' }, 'hi'] },
      c: { kind: 'color', alpha: true },
    });
    expect(schema.defaults()).toEqual({ n: 2, bare: 0, b: false, e: 'lo', c: '#000000' });
  });

  it('nests groups, so a value sits at the same path as in the description', () => {
    const schema = f.params({
      look: {
        kind: 'group',
        label: 'Look',
        description: 'How it reads',
        params: { inner: { kind: 'group', params: { glow: { kind: 'number', default: 3 } } } },
      },
    });
    expect(schema.defaults()).toEqual({ look: { inner: { glow: 3 } } });
    const look = resolved(schema).group.children.look;
    expect(look).toMatchObject({ name: 'Look', description: 'How it reads' });
    expectTypeOf<ConfigOf<typeof schema>>().toEqualTypeOf<{ look: { inner: { glow: number } } }>();
  });

  it('labels a choice’s options and carries a color’s alpha', () => {
    const { children } = resolved(
      f.params({
        mode: { kind: 'enum', options: [{ value: 'a', label: 'Alpha' }, 'b'], default: 'b' },
        tint: { kind: 'color', default: '#ff000080', alpha: true, label: 'Tint' },
      }),
    ).group;
    expect(children.mode).toMatchObject({
      kind: 'enum',
      default: 'b',
      options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'b' },
      ],
    });
    expect(children.tint).toMatchObject({ kind: 'color', alpha: true, name: 'Tint' });
  });

  it('types the config from the description', () => {
    expectTypeOf<ConfigOf<ReturnType<typeof f.params<typeof AGNEW>>>>().toEqualTypeOf<{
      axis: 'x' | 'y' | 'z';
      R: number;
      twist: number;
      capped: boolean;
    }>();
  });

  it('compiles a description that went through JSON to the same schema', () => {
    for (const [shape, defaults] of [
      [MAGICSMOKE, MAGICSMOKE_DEFAULTS],
      [AGNEW, undefined],
      [BEAMOS, undefined],
    ] as const) {
      const copy = JSON.parse(JSON.stringify(shape)) as ParamShape;
      expect(copy).toEqual(shape);
      expect(resolved(f.params(copy, { defaults }))).toEqual(resolved(f.params(shape, { defaults })));
    }
  });

  it('throws on a default of the wrong type, or a choice that is not an option', () => {
    expect(() =>
      f.params({ n: { kind: 'number' } }, { defaults: { n: 'three' } }),
    ).toThrow(/default given for n is "three", not a number/);
    expect(() =>
      f.params({ e: { kind: 'enum', options: ['a'], default: 'z' as 'a' } }),
    ).toThrow(/not one of its options/);
  });
});
