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
});
