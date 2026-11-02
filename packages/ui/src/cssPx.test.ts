import { describe, expect, it } from 'vitest';
import { cssPx } from './cssPx';

describe('cssPx', () => {
  it('reads the number a length starts with', () => {
    expect(cssPx('12px')).toBe(12);
    expect(cssPx(' 1.5px')).toBe(1.5);
    expect(cssPx('-3px')).toBe(-3);
    expect(cssPx('0.8')).toBe(0.8);
  });

  it('gives 0 where there is no number', () => {
    expect(cssPx('normal')).toBe(0);
    expect(cssPx('auto')).toBe(0);
    expect(cssPx('')).toBe(0);
    expect(cssPx('calc(4px * 2)')).toBe(0);
  });
});
