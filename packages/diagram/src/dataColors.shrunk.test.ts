import { describe, expect, it } from 'vitest';
import { withColors } from './dataColors';

describe('withColors, shrunk', () => {
  it('keeps a __proto__ color read from JSON as a key, not as the result\'s prototype', () => {
    const out = withColors({}, JSON.parse('{"__proto__":{"x":1}}') as object) as Record<string, unknown>;
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.hasOwn(out, '__proto__')).toBe(true);
  });
});
