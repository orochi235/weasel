import { describe, it, expect, expectTypeOf } from 'vitest';
import { TOOL_PREF_KINDS, isBuiltinToolPref, prefUnit } from './prefs';
import { ANGLE_RADIANS, METRIC_MM } from 'core/units';
import type {
  ToolPref,
  ToolPrefKind,
  ToolPrefColor,
  ToolPrefCustom,
  ToolPrefGroup,
  ToolPrefLeaf,
  ToolPrefNumber,
} from './prefs';

describe('ToolPref schema additions', () => {
  it('accepts color, custom, pair, and unit fields', () => {
    const fill: ToolPrefColor = {
      kind: 'color',
      name: 'Fill',
      description: 'Fill color.',
      default: '#000000ff',
      alpha: true,
    };
    const x: ToolPrefNumber = {
      kind: 'number',
      name: 'X',
      description: 'Left edge.',
      default: 0,
      pair: 'Position',
    };
    const rotation: ToolPrefNumber = {
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
    const custom: ToolPrefCustom = {
      kind: 'my-app-kind',
      name: 'Special',
      description: 'App-defined leaf.',
      default: null,
    };
    const group: ToolPrefGroup = {
      name: 'Layout',
      children: { 'pose.x': x, 'pose.rotation': rotation, 'data.fill': fill, 'data.special': custom },
    };
    const leaves: ToolPrefLeaf[] = [fill, x, rotation, custom];
    expect(Object.keys(group.children)).toHaveLength(4);
    expect(leaves).toHaveLength(4);
  });
});

describe('built-in kind table', () => {
  it('lists exactly the kinds the built-in union declares', () => {
    expectTypeOf<keyof typeof TOOL_PREF_KINDS>().toEqualTypeOf<ToolPrefKind>();
    expectTypeOf<ToolPref['kind']>().toEqualTypeOf<ToolPrefKind>();
    expect(Object.keys(TOOL_PREF_KINDS).sort()).toEqual(
      ['boolean', 'color', 'enum', 'number', 'object', 'paint', 'string'],
    );
  });

  it('narrows a built-in leaf and rejects an app-defined one', () => {
    const custom: ToolPrefCustom = {
      kind: 'registry-enum', name: 'Shape', description: '', default: null,
    };
    const color: ToolPrefColor = {
      kind: 'color', name: 'Fill', description: '', default: '#000000',
    };
    expect(isBuiltinToolPref(custom)).toBe(false);
    expect(isBuiltinToolPref(color)).toBe(true);
    // A leaf whose kind collides with an Object.prototype key is app-defined
    // like any other — `in` would answer true here.
    expect(isBuiltinToolPref({ ...custom, kind: 'toString' })).toBe(false);
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
});
