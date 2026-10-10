import { describe, it, expect, expectTypeOf } from 'vitest';
import { PREF_KINDS, isBuiltinPref, pairRowsOf, prefUnit } from './schema';
import { ANGLE_RADIANS, METRIC_MM, type UnitSystem } from '@weasel-js/quantity';

/** Temperature is the smallest system whose units disagree about zero. */
const TEMPERATURE_K: UnitSystem = {
  base: 'K',
  units: { K: 1, degC: { factor: 1, offset: 273.15 } },
};
import type {
  BuiltinPref,
  PrefKind,
  PrefColor,
  PrefCustom,
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

describe('built-in kind table', () => {
  it('lists exactly the kinds the built-in union declares', () => {
    expectTypeOf<keyof typeof PREF_KINDS>().toEqualTypeOf<PrefKind>();
    expectTypeOf<BuiltinPref['kind']>().toEqualTypeOf<PrefKind>();
    expect(Object.keys(PREF_KINDS).sort()).toEqual(
      ['action', 'boolean', 'color', 'enum', 'field', 'list', 'number', 'object', 'paint', 'string'],
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

describe('prefUnit', () => {
  it('stores the base unit and shows the display unit', () => {
    const cm = prefUnit(METRIC_MM, 'cm');
    expect(cm.toDisplay(25)).toBe(2.5);
    expect(cm.fromDisplay(2.5)).toBe(25);
    expect(cm.suffix).toBe('cm');
  });

  it('rounds what it shows to the precision given, and nothing else', () => {
    const deg = prefUnit(ANGLE_RADIANS, 'deg', { precision: 1 });
    expect(deg.toDisplay(Math.PI / 3)).toBe(60);
    expect(deg.toDisplay(0.001)).toBe(0.1);
    expect(deg.fromDisplay(90)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('accepts every unit in the system, scaled to the display unit, and its suffix', () => {
    const deg = prefUnit(ANGLE_RADIANS, 'deg', { suffix: '°' });
    expect(deg.suffix).toBe('°');
    expect(deg.accepts?.['°']).toBe(1);
    expect(deg.accepts?.deg).toBe(1);
    expect(deg.accepts?.turn).toBeCloseTo(360);
    expect(prefUnit(METRIC_MM, 'cm').accepts).toEqual({ mm: 0.1, cm: 1, m: 100, km: 100_000 });
  });

  it('throws on a display unit the system does not have', () => {
    expect(() => prefUnit(METRIC_MM, 'ft')).toThrow(/unknown unit 'ft'/);
  });

  it('converts through an offset in both directions', () => {
    const c = prefUnit(TEMPERATURE_K, 'degC', { precision: 2 });
    expect(c.toDisplay(273.15)).toBe(0);
    expect(c.toDisplay(373.15)).toBe(100);
    expect(c.fromDisplay(0)).toBeCloseTo(273.15, 9);
  });

  it('accepts an offset unit as a scale rather than a bare factor', () => {
    const c = prefUnit(TEMPERATURE_K, 'degC');
    // Typing `0K` into a field showing degC is −273.15, not 0 — which a bare
    // factor cannot say.
    expect(c.accepts?.K).toEqual({ factor: 1, offset: -273.15 });
    // A pure scale stays a bare number, so the common table reads as one.
    expect(prefUnit(METRIC_MM, 'cm').accepts?.mm).toBe(0.1);
  });

  it('formats a stored value in the display unit', () => {
    const cm = prefUnit(METRIC_MM, 'cm');
    expect(cm.format?.(25)).toBe('2.5cm');
    expect(prefUnit(ANGLE_RADIANS, 'deg', { precision: 1, suffix: '°' }).format?.(Math.PI)).toBe(
      '180°',
    );
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
