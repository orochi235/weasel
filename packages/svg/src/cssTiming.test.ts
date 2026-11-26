import { describe, expect, it } from 'vitest';
import { resolveKeyEasing } from '@weasel-js/animator';
import { cssEasing, reversedEasing } from './cssTiming';

describe('cssEasing', () => {
  it('carries steps() jumping at both ends or neither', () => {
    expect(cssEasing('steps(4, jump-both)')).toEqual({ steps: 4, jump: 'both' });
    expect(cssEasing('steps(4, jump-none)')).toEqual({ steps: 4, jump: 'none' });
    expect(cssEasing('steps(1, jump-none)')).toBeNull();
    expect(cssEasing('steps(2, sideways)')).toBeNull();
  });

  it('plays steps(4, jump-both) and steps(3, jump-none) as a browser does', () => {
    const both = resolveKeyEasing({ steps: 4, jump: 'both' });
    expect([0, 0.1, 0.3, 0.6, 0.9, 1].map(both)).toEqual([0.2, 0.2, 0.4, 0.6, 0.8, 1]);
    const none = resolveKeyEasing({ steps: 3, jump: 'none' });
    expect([0, 0.3, 0.5, 0.9, 1].map(none)).toEqual([0, 0, 0.5, 1, 1]);
  });

  it('carries linear() stops with zero, one or two percentages', () => {
    expect(cssEasing('linear(0, 0.25 75%, 1 90% 100%)')).toEqual({ linear: [0, [0.25, 0.75], [1, 0.9, 1]] });
    expect(cssEasing('linear(0, 50% 0.8, 1)')).toEqual({ linear: [0, [0.8, 0.5], 1] });
    expect(cssEasing('linear(0)')).toBeNull();
    expect(cssEasing('linear(0, 1 2 3)')).toBeNull();
  });

  it('plays linear() as a browser does', () => {
    const f = resolveKeyEasing(cssEasing('linear(0, 0.25 75%, 1)')!);
    expect(f(0.375)).toBeCloseTo(0.125, 12);
    expect(f(0.875)).toBeCloseTo(0.625, 12);
  });
});

describe('reversedEasing', () => {
  it('swaps a step\'s jump between start and end, and keeps both and none', () => {
    expect(reversedEasing({ steps: 3, jump: 'start' })).toEqual({ steps: 3, jump: 'end' });
    expect(reversedEasing({ steps: 3 })).toEqual({ steps: 3, jump: 'start' });
    expect(reversedEasing({ steps: 3, jump: 'both' })).toEqual({ steps: 3, jump: 'both' });
    expect(reversedEasing({ steps: 3, jump: 'none' })).toEqual({ steps: 3, jump: 'none' });
  });

  it('runs a linear() curve backward: f\'(u) = 1 − f(1 − u)', () => {
    const e = cssEasing('linear(0, 0.25 75%, 0.4 80% 90%, 1)')!;
    const f = resolveKeyEasing(e);
    const g = resolveKeyEasing(reversedEasing(e)!);
    for (const u of [0, 0.05, 0.15, 0.3, 0.5, 0.77, 0.95, 1]) expect(g(u)).toBeCloseTo(1 - f(1 - u), 12);
  });

  it('places unset inputs evenly before reversing them', () => {
    const e = cssEasing('linear(0, 0.1, 0.5 50%, 0.7, 0.9, 1)')!;
    const f = resolveKeyEasing(e);
    const g = resolveKeyEasing(reversedEasing(e)!);
    for (const u of [0.1, 0.25, 0.4, 0.6, 0.8]) expect(g(u)).toBeCloseTo(1 - f(1 - u), 12);
  });
});
