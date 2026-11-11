import { describe, expect, it } from 'vitest';
import { colorCount, colorCssAt } from './colorList';

describe('color lists, shrunk counterexamples', () => {
  it('has no ramp named like an Object.prototype member', () => {
    expect(() => colorCssAt({ ramp: 'constructor' }, 0)).toThrow('has no ramp "constructor"');
    expect(() => colorCount({ ramp: 'toString' })).toThrow('has no ramp "toString"');
  });
});
