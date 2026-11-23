import { describe, expect, it } from 'vitest';
import { makeMatchMedia } from './matchMedia';

describe('makeMatchMedia', () => {
  it('answers matches live on a list held across fire()', () => {
    const { mm, fire } = makeMatchMedia({ '(q)': false });
    const list = mm('(q)');
    fire('(q)', true);
    expect(list.matches).toBe(true);
  });
});
