import { describe, expect, it } from 'vitest';
import { blur, vignette } from './builtins';
import { effectsReach } from './types';

describe('effectsReach', () => {
  it('adds up each pass, a blur reaching its radius per pass, rounded up', () => {
    expect(effectsReach(blur({ radius: 2.5 }))).toBe(6);
    expect(effectsReach([])).toBe(0);
  });

  it('is unbounded when any pass does not say how far it reaches', () => {
    expect(effectsReach([...blur({ radius: 2 }), ...vignette({ amount: 0.5 })])).toBe(Infinity);
  });
});
