import { describe, expect, it } from 'vitest';
import type { UnitSystem } from '@weasel-js/core';
import { gridLines } from './reading';

// A unit putting its zero 5 base units out: a length in it is 10 per unit either way.
const SHIFTED: UnitSystem = { base: 'b', units: { b: 1, u: { factor: 10, offset: 5 } } };

describe('gridLines', () => {
  it('reads a tagged length without its unit\'s offset, with scopes or without', () => {
    const spacing = { x: { pitch: { value: 1, unit: 'u' }, offset: { value: 2, unit: 'u' }, to: { value: 3, unit: 'u' } } };
    const unscoped = gridLines(spacing, SHIFTED, undefined);
    const scoped = gridLines(spacing, undefined, { root: { system: SHIFTED } });
    expect(unscoped.x).toEqual({ pitch: 10, offset: 20, from: -Infinity, to: 30 });
    expect(unscoped).toEqual(scoped);
  });

  it('reads explicit positions without the offset too', () => {
    expect(gridLines({ x: { at: [{ value: 1, unit: 'u' }] } }, SHIFTED, undefined).x).toEqual({ at: [10] });
  });
});
