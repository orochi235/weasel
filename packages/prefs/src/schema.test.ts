import { describe, it, expect, expectTypeOf } from 'vitest';
import { PREF_KINDS, isBuiltinPref, pairRowsOf } from './schema';
import type {
  BuiltinPref,
  PrefKind,
  PrefColor,
  PrefCustom,
  PrefEnum,
  PrefLeaf,
  PrefNumber,
  PrefPair,
} from './schema';
import type { PrefSection } from './groups';

describe('BuiltinPref schema additions', () => {
  it('accepts color, custom, pair, and unit fields', () => {
    const fill: PrefColor = {
      kind: 'color',
      name: 'Fill',
      description: 'Fill color.',
      default: '#000000ff',
      alpha: true,
    };
    const x: PrefNumber = {
      kind: 'number',
      name: 'X',
      description: 'Left edge.',
      default: 0,
      pair: { with: 'pose.y', label: 'Position' },
    };
    const rotation: PrefNumber = {
      kind: 'number',
      name: 'Rotation',
      description: 'Rotation about center.',
      default: 0,
      unit: {
        toDisplay: (rad) => (rad * 180) / Math.PI,
        fromDisplay: (deg) => (deg * Math.PI) / 180,
        suffix: '°',
      },
    };
    const custom: PrefCustom = {
      kind: 'my-app-kind',
      name: 'Special',
      description: 'App-defined leaf.',
      default: null,
    };
    const section: PrefSection = {
      name: 'Layout',
      members: { 'pose.x': x, 'pose.rotation': rotation, 'data.fill': fill, 'data.special': custom },
    };
    const leaves: PrefLeaf[] = [fill, x, rotation, custom];
    expect(Object.keys(section.members)).toHaveLength(4);
    expect(leaves).toHaveLength(4);
  });
});

describe('a clearable enum', () => {
  it('cannot declare a default, since a missing value is how cleared is stored', () => {
    const options = [{ value: 'a', label: 'A' }];
    const cleared: PrefEnum = { kind: 'enum', name: 'E', description: '', default: undefined, clearable: true, options };
    // @ts-expect-error a clearable enum's default is undefined
    const pair: PrefEnum = { kind: 'enum', name: 'E', description: '', default: 'a', clearable: true, options };
    const plain: PrefEnum = { kind: 'enum', name: 'E', description: '', default: 'a', options };
    expect([cleared.default, pair.clearable, plain.default]).toEqual([undefined, true, 'a']);
  });
});

describe('built-in kind table', () => {
  it('lists exactly the kinds the built-in union declares', () => {
    expectTypeOf<keyof typeof PREF_KINDS>().toEqualTypeOf<PrefKind>();
    expectTypeOf<BuiltinPref['kind']>().toEqualTypeOf<PrefKind>();
    expect(Object.keys(PREF_KINDS).sort()).toEqual(
      ['action', 'alias', 'boolean', 'color', 'enum', 'field', 'label', 'list', 'map', 'number', 'object', 'paint', 'separator', 'string', 'union'],
    );
  });

  it('narrows a built-in leaf and rejects an app-defined one', () => {
    const custom: PrefCustom = {
      kind: 'registry-enum', name: 'Shape', description: '', default: null,
    };
    const color: PrefColor = {
      kind: 'color', name: 'Fill', description: '', default: '#000000',
    };
    expect(isBuiltinPref(custom)).toBe(false);
    expect(isBuiltinPref(color)).toBe(true);
    // A leaf whose kind collides with an Object.prototype key is app-defined
    // like any other — `in` would answer true here.
    expect(isBuiltinPref({ ...custom, kind: 'toString' })).toBe(false);
  });
});

describe('pairRowsOf', () => {
  const leaf = (name: string, pair?: PrefPair): PrefLeaf =>
    ({ kind: 'number', name, description: '', default: 0, ...(pair ? { pair } : {}) });

  it('puts the declaring leaf and every path it names on one row, labeled by the override', () => {
    const rows = pairRowsOf([
      ['pose.x', leaf('X', { with: 'pose.y', label: 'Position' })],
      ['pose.y', leaf('Y')],
      ['pose.w', leaf('W')],
    ]);
    expect(rows.get('pose.x')).toEqual({ key: 'pose.x', label: 'Position' });
    expect(rows.get('pose.y')).toBe(rows.get('pose.x'));
    expect(rows.has('pose.w')).toBe(false);
  });

  it("labels a row with the declaring leaf's name when no label overrides it", () => {
    const rows = pairRowsOf([['a', leaf('Size', { with: ['b', 'c'] })], ['b', leaf('B')], ['c', leaf('C')]]);
    expect(rows.get('c')).toEqual({ key: 'a', label: 'Size' });
  });
});
