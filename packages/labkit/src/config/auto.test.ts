import { describe, expect, it } from 'vitest';
import { AUTO, isAuto } from './auto';

describe('auto', () => {
  it('is a symbol distinct from every ordinary config value', () => {
    expect(typeof AUTO).toBe('symbol');
    expect(isAuto(AUTO)).toBe(true);
    for (const v of [undefined, null, 0, '', 'auto', false, Symbol('auto'), {}]) {
      expect(isAuto(v)).toBe(false);
    }
  });
});
