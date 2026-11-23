import { describe, it, expect } from 'vitest';
import { own } from './owned';

describe('own', () => {
  it('freezes the nested values of an object the caller froze only at the top', () => {
    const data = own(Object.freeze({ style: { fill: 'red' }, stops: [{ at: 0 }] }));
    expect(Object.isFrozen(data.style)).toBe(true);
    expect(Object.isFrozen(data.stops[0])).toBe(true);
  });

  it('freezes a cyclic plain object without looping', () => {
    const a: { self?: unknown; inner: { n: number } } = { inner: { n: 1 } };
    a.self = a;
    own(a);
    expect(Object.isFrozen(a.inner)).toBe(true);
  });
});
