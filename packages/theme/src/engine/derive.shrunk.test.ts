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
});
