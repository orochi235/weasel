import { describe, expect, it } from 'vitest';
import { setOwn } from './setOwn';

describe('setOwn', () => {
  it('sets `__proto__` as an own key, leaving the prototype alone', () => {
    const r: Record<string, number> = {};
    setOwn(r, '__proto__', 1);
    expect(Object.getPrototypeOf(r)).toBe(Object.prototype);
    expect(Object.keys(r)).toEqual(['__proto__']);
    expect(r['__proto__']).toBe(1);
    setOwn(r, '__proto__', 2);
    expect(JSON.stringify(r)).toBe('{"__proto__":2}');
  });
});
