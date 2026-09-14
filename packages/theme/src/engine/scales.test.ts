import { describe, expect, it } from 'vitest';
import { scale } from './scales';

describe('scale', () => {
  it('steps linearly from base', () => {
    expect(scale(['xs', 'sm', 'md', 'lg'], { base: 4, step: 4 })).toEqual({ xs: '4px', sm: '8px', md: '12px', lg: '16px' });
  });

  it('steps geometrically and rounds to whole px', () => {
    expect(scale(['a', 'b', 'c'], { base: 10, ratio: 1.25 })).toEqual({ a: '10px', b: '13px', c: '16px' });
  });

  it('refuses both or neither of step and ratio', () => {
    expect(() => scale(['a'], { base: 1, step: 1, ratio: 2 })).toThrow(/exactly one/);
    expect(() => scale(['a'], { base: 1 })).toThrow(/exactly one/);
  });
});
