/** Counterexamples `derive.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { derive } from './derive';

const GRAY = { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16] } as const;

describe('derive, names Object.prototype holds', () => {
  it('reports a step rule on a ramp named toString that nothing declares, rather than throwing', () => {
    const def: ThemeDefinition = { name: 't', semantics: { surface: { ramp: 'toString', step: '50' } } };
    expect(derive(def).issues).toEqual([{ kind: 'invalid', path: 'semantics.surface', message: 'no such step on ramp "toString"' }]);
  });

  it('reports a contrast rule on a ramp named toString that nothing declares, rather than throwing', () => {
    const def: ThemeDefinition = {
      name: 't',
      ramps: { gray: GRAY },
      semantics: { surface: { ramp: 'gray', step: '50' }, text: { ramp: 'toString', contrast: { min: 3, against: ['surface'] } } },
    };
    expect(derive(def).issues).toEqual([{ kind: 'invalid', path: 'semantics.text', message: 'no ramp "toString"' }]);
  });

  it('measures contrast against a semantic named constructor', () => {
    const def: ThemeDefinition = {
      name: 't',
      ramps: { gray: GRAY },
      semantics: { constructor: { value: '#ffffff', type: 'color' }, text: { ramp: 'gray', contrast: { min: 4.5, against: ['constructor'] } } },
      pins: { loose: { value: '1px', type: 'dimension' } },
    };
    const { tokens, issues } = derive(def);
    expect(issues).toEqual([]);
    expect(tokens.text!.value).toBe('{gray-900}');
  });

  it('offsets from a semantic named constructor', () => {
    const def: ThemeDefinition = {
      name: 't',
      ramps: { gray: GRAY },
      semantics: { constructor: { ramp: 'gray', step: '50' }, text: { from: 'constructor', offset: 1, dir: 'away' } },
      pins: { loose: { value: '1px', type: 'dimension' } },
    };
    const { tokens, issues } = derive(def);
    expect(issues).toEqual([]);
    expect(tokens.text!.value).toBe('{gray-900}');
  });
});

describe('derive, categorical gates', () => {
  const gated = (gates: Record<string, unknown>) => derive({ name: 't', ramps: { c: { kind: 'categorical', steps: ['a', 'b'], gates } } } as ThemeDefinition);

  it('reports a surface that is not a hex color, rather than throwing', () => {
    expect(gated({ surface: 'x' }).issues).toEqual([{ kind: 'invalid', path: 'ramps.c.gates.surface', message: 'expected a hex color' }]);
  });

  it('reports a gate number that is not finite, and an order it does not know', () => {
    expect(gated({ hueFloor: Number.NaN, order: 'x' }).issues).toEqual([
      { kind: 'invalid', path: 'ramps.c.gates.hueFloor', message: 'expected a number' },
      { kind: 'invalid', path: 'ramps.c.gates.order', message: 'expected "hue" or "farthest"' },
    ]);
  });
});
