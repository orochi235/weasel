import { describe, expect, it } from 'vitest';
import { scale } from './scales';

describe('scale', () => {
  it('steps linearly from base', () => {
    expect(scale(['xs', 'sm', 'md', 'lg'], { base: 4, step: 4 })).toEqual({ xs: '4px', sm: '8px', md: '12px', lg: '16px' });
  });

  it('steps geometrically and rounds to whole px', () => {
    expect(scale(['a', 'b', 'c'], { base: 10, ratio: 1.25 })).toEqual({ a: '10px', b: '13px', c: '16px' });
  });

  it('refuses more or fewer than one of step, ratio and factors', () => {
    expect(() => scale(['a'], { base: 1, step: 1, ratio: 2 })).toThrow(/exactly one/);
    expect(() => scale(['a'], { base: 1, step: 1, factors: [1] })).toThrow(/exactly one/);
    expect(() => scale(['a'], { base: 1 })).toThrow(/exactly one/);
  });

  it('multiplies the base by an explicit factor per step', () => {
    expect(scale(['sm', 'md', 'lg'], { base: 10, factors: [0.5, 1, 2] })).toEqual({ sm: '5px', md: '10px', lg: '20px' });
  });

  // The shipped type ramp is compressed at the small end on purpose — chrome text stops
  // being legible before a geometric ramp stops shrinking — so no `ratio` reproduces it.
  it('reproduces the weasel type ramp from one base', () => {
    expect(scale(['2xs', 'xs', 'sm', 'md', 'lg', 'xl'], { base: 13, factors: [0.7, 0.77, 0.85, 1, 1.23, 1.54] })).toEqual({
      '2xs': '9px',
      xs: '10px',
      sm: '11px',
      md: '13px',
      lg: '16px',
      xl: '20px',
    });
  });

  it('refuses a factor list that does not cover the steps', () => {
    expect(() => scale(['a', 'b'], { base: 1, factors: [1] })).toThrow(/one factor per step/);
  });
});
