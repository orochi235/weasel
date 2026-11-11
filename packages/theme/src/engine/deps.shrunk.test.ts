/** Counterexamples `derive.pbt.test.ts` shrank to for `axisDependencies`, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import type { AxisDefs } from '../axes';
import type { ThemeDefinition } from '../definition';
import { axisDependencies } from './deps';

const AXES: AxisDefs = {
  mode: { default: 'dark', values: { dark: {}, light: {} } },
  density: { default: 'compact', values: { compact: {}, roomy: {} } },
};
const RAMP = { kind: 'lightness', steps: ['50', '900'], lightness: { by: 'mode', dark: [0, 0], light: [0.06, 0] } } as const;

describe('axisDependencies of a pin that leaves selections to what it pins', () => {
  it('keeps the ramp step’s own axes under a by-axis pin with no values', () => {
    const def: ThemeDefinition = { name: 't', axes: AXES, ramps: { gray: RAMP }, pins: { 'gray-50': { by: 'density' } } };
    expect(axisDependencies(def)['gray-50']).toEqual({ own: ['mode', 'density'], all: ['mode', 'density'] });
  });

  it('keeps them under a pin whose seed has no value at some selection', () => {
    const def: ThemeDefinition = {
      name: 't', axes: AXES, seeds: { ink: { by: 'density', compact: '#ff0000' } }, ramps: { gray: RAMP }, pins: { 'gray-50': '{seeds.ink}' },
    };
    expect(axisDependencies(def)['gray-50']!.all).toEqual(['mode', 'density']);
  });

  it('takes only the pin’s axes where it applies at every selection', () => {
    const def: ThemeDefinition = { name: 't', axes: AXES, ramps: { gray: RAMP }, pins: { 'gray-50': { by: 'density', compact: '#000000', roomy: '#ffffff' } } };
    expect(axisDependencies(def)['gray-50']).toEqual({ own: ['density'], all: ['density'] });
  });
});
