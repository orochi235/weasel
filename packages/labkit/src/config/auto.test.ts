import { describe, expect, it } from 'vitest';
import { auto, isAuto } from './auto';

describe('auto', () => {
  it('is a symbol distinct from every ordinary config value', () => {
    expect(typeof auto).toBe('symbol');
    expect(isAuto(auto)).toBe(true);
    for (const v of [undefined, null, 0, '', 'auto', false, Symbol('auto'), {}]) {
      expect(isAuto(v)).toBe(false);
    }
  });

  it('cannot cross a structured-clone boundary', () => {
    // Which is exactly why it can never end up in a serialized trial by
    // accident: the store strips it long before anything tries.
    expect(() => structuredClone({ gap: auto })).toThrow();
  });
});
