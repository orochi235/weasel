import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { axisDependencies } from './deps';

const D: ThemeDefinition = {
  name: 'd',
  axes: {
    mode: { default: 'dark', values: { dark: {}, light: {} } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  seeds: { unit: { by: 'density', comfortable: 4, compact: 3 } },
  ramps: { gray: { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16] } },
  scales: { space: { steps: ['sm', 'md'], base: '{seeds.unit}', step: 4 } },
  semantics: {
    surface: { ramp: 'gray', step: { by: 'mode', dark: '900', light: '50' } },
    line: { ref: 'surface', alpha: 0.2 },
    edge: { ramp: 'gray', contrast: { min: 3, against: ['surface'] } },
    pad: { ref: 'space-md' },
    chip: { ref: 'pad' },
    mixed: { by: 'mode', dark: { ref: 'pad' }, light: { value: '1px', type: 'dimension' } },
  },
  pins: { 'radius-md': '5px', hairline: '{line}' },
};

describe('axisDependencies', () => {
  const deps = axisDependencies(D);

  it('finds a by on the token itself, directly or through a seed', () => {
    expect(deps.surface).toEqual({ own: ['mode'], all: ['mode'] });
    expect(deps['space-md']).toEqual({ own: ['density'], all: ['density'] });
  });

  it('follows references, rule inputs and pin values', () => {
    expect(deps.line).toEqual({ own: [], all: ['mode'] });
    expect(deps.edge).toEqual({ own: [], all: ['mode'] });
    expect(deps.hairline).toEqual({ own: [], all: ['mode'] });
  });

  it('counts a token that reaches density only through a chain of references', () => {
    expect(deps.chip).toEqual({ own: [], all: ['density'] });
  });

  it('orders axes by declaration and leaves invariant tokens empty', () => {
    expect(deps.mixed).toEqual({ own: ['mode'], all: ['mode', 'density'] });
    expect(deps['radius-md']).toEqual({ own: [], all: [] });
    expect(deps['gray-50']).toEqual({ own: [], all: [] });
  });

  it('takes a pinned token’s dependencies from its pin', () => {
    const pinned = axisDependencies({ ...D, pins: { ...D.pins, surface: '#000000' } });
    expect(pinned.surface).toEqual({ own: [], all: [] });
    expect(pinned.line).toEqual({ own: [], all: [] });
  });

  it('gives a ramp whose whole lightness pair is a by on mode own: [mode] on its steps', () => {
    const varied = axisDependencies({
      ...D,
      ramps: {
        ...D.ramps,
        gray: { kind: 'lightness', steps: ['50', '900'], lightness: { by: 'mode', dark: [0.16, 0.97], light: [0.97, 0.16] } },
      },
    });
    expect(varied['gray-50']).toEqual({ own: ['mode'], all: ['mode'] });
    expect(varied['gray-900']).toEqual({ own: ['mode'], all: ['mode'] });
  });

  it('converges on a reference cycle instead of leaving mid-cycle nodes empty', () => {
    const cyclic = {
      name: 'cyclic',
      axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } },
      semantics: {
        A: { by: 'mode', dark: { ref: 'B' }, light: { value: '#000', type: 'color' } },
        B: { ref: 'A' },
        C: { ref: 'B' },
      },
    } as unknown as ThemeDefinition;
    const deps = axisDependencies(cyclic);
    expect(deps.A).toEqual({ own: ['mode'], all: ['mode'] });
    expect(deps.B).toEqual({ own: [], all: ['mode'] });
    expect(deps.C).toEqual({ own: [], all: ['mode'] });
  });

  it('collects step names from every branch of a by-varying ramp `steps`, and owns the by axis', () => {
    const varied = axisDependencies({
      ...D,
      ramps: {
        ...D.ramps,
        gray: { kind: 'lightness', steps: { by: 'mode', dark: ['50', '900'], light: ['50'] }, lightness: [0.97, 0.16] },
      },
    } as unknown as ThemeDefinition);
    expect(varied['gray-50']).toEqual({ own: ['mode'], all: ['mode'] });
    expect(varied['gray-900']).toEqual({ own: ['mode'], all: ['mode'] });
  });

  it('collects step names from every branch of a by-varying scale `steps`, and owns the by axis', () => {
    const varied = axisDependencies({
      ...D,
      scales: {
        ...D.scales,
        gap: { steps: { by: 'density', comfortable: ['sm'], compact: ['sm', 'md'] }, base: 4, step: 4 },
      },
    } as unknown as ThemeDefinition);
    expect(varied['gap-sm']).toEqual({ own: ['density'], all: ['density'] });
    expect(varied['gap-md']).toEqual({ own: ['density'], all: ['density'] });
  });

  it('follows a step rule whose `step` picks a ramp step through a nested by', () => {
    const nested = axisDependencies({
      ...D,
      ramps: {
        ...D.ramps,
        gray: {
          kind: 'lightness',
          steps: ['50', '900'],
          lightness: { by: 'density', comfortable: [0.97, 0.16], compact: [0.9, 0.1] },
        },
      },
      semantics: {
        ...D.semantics,
        surface: {
          ramp: 'gray',
          step: { by: 'mode', dark: { by: 'density', comfortable: '900', compact: '50' }, light: '50' },
        },
      },
    } as unknown as ThemeDefinition);
    // Reaches every branch of the nested by (gray-900 and gray-50), which is how
    // `density` — invisible to a scan of the rule's own `step` shape's step *names* —
    // reaches `surface.all` through the ramp steps themselves.
    expect(nested.surface).toEqual({ own: ['mode', 'density'], all: ['mode', 'density'] });
  });

  it("reads a pinned semantic's dependencies from its pin, not the rule it replaces, through an offset that references it", () => {
    const pinned = axisDependencies({
      ...D,
      pins: { ...D.pins, surface: { by: 'density', comfortable: '{gray-900}', compact: '{gray-50}' } },
      semantics: { ...D.semantics, edge: { from: 'surface', offset: 1, dir: 'away' } },
    });
    expect(pinned.edge).toEqual({ own: [], all: ['density'] });
  });
});
