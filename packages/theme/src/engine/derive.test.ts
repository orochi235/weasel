import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { derive } from './derive';

const T: ThemeDefinition = {
  name: 't',
  axes: {
    mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  seeds: { unit: { by: 'density', comfortable: 4, compact: 3 } },
  ramps: { gray: { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16], describe: { '50': 'lightest' } } },
  scales: { space: { steps: ['sm', 'md'], base: '{seeds.unit}', step: '{seeds.unit}' } },
  semantics: {
    surface: { ramp: 'gray', step: { by: 'mode', dark: '900', light: '50' } },
    line: { ref: 'surface', alpha: 0.2, type: 'color' },
    shadow: { value: 'rgba(0, 0, 0, 0.6)', type: 'color' },
  },
  components: { 'tb-height': { value: '28px', type: 'dimension' } },
  pins: { 'gray-900': '#141820', 'radius-md': { value: '5px', type: 'dimension' } },
};

describe('derive', () => {
  it('emits in layer order, then definition order, with a pinned token left in place', () => {
    expect(Object.keys(derive(T).tokens)).toEqual([
      'gray-50', 'gray-900', 'space-sm', 'space-md', 'surface', 'line', 'shadow', 'tb-height', 'radius-md',
    ]);
  });

  it('resolves seeds per selection', () => {
    expect(derive(T, { density: 'compact' }).tokens['space-md'].value).toBe('6px');
    expect(derive(T).tokens['space-md'].value).toBe('8px');
  });

  it('points a step semantic at the ramp token for the selection', () => {
    expect(derive(T).tokens.surface.value).toBe('{gray-900}');
    expect(derive(T, { mode: 'light' }).tokens.surface.value).toBe('{gray-50}');
    expect(derive(T).tokens.line).toMatchObject({ value: '{surface}', alpha: 0.2 });
  });

  it('records what a pin overrode, and treats a pin with nothing under it as authored', () => {
    const { tokens, provenance } = derive(T);
    expect(tokens['gray-900'].value).toBe('#141820');
    expect(provenance['gray-900']).toMatchObject({ layer: 'ramps', rule: 'lightness', pinned: true });
    expect(provenance['gray-900'].generated?.value).toMatch(/^#[0-9a-f]{6}$/);
    expect(provenance['radius-md']).toEqual({ layer: 'pins', rule: 'value', pinned: false });
    expect(tokens['gray-50'].description).toBe('lightest');
  });

  it('reports an untyped pin and a missing axis value without throwing', () => {
    // `edge` is referenced by nothing, so leaving it underived dangles no reference.
    const { issues } = derive(
      { ...T, pins: { ...T.pins, loose: '1px' }, semantics: { ...T.semantics, edge: { ramp: 'gray', step: { by: 'mode', dark: '900' } } } },
      { mode: 'light' },
    );
    expect(issues).toContainEqual({ kind: 'untyped-pin', token: 'loose' });
    expect(issues).toContainEqual({ kind: 'missing-axis-value', path: 'semantics.edge.step', axis: 'mode', value: 'light' });
  });

  it('throws on a dangling reference', () => {
    expect(() => derive({ ...T, pins: { a: { value: '{nope}', type: 'color' } } })).toThrow(/nope/);
  });

  it('reports a categorical ramp whose gates cannot be met', () => {
    const steps = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const { issues } = derive({
      name: 'x',
      ramps: { swatch: { kind: 'categorical', steps, gates: { hueFloor: (40 * 12) / 360, minDistance: 0, minSurfaceDistance: 0 } } },
    });
    expect(issues).toContainEqual({ kind: 'infeasible-ramp', ramp: 'swatch' });
  });
});
