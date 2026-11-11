import { describe, expect, it } from 'vitest';
import { expandVars } from './boxShadow';

describe('expandVars, shrunk counterexamples', () => {
  it('reads a reference named like an Object.prototype member as missing, not as the member', () => {
    expect(() => expandVars('var(__proto__)', {})).toThrow('expandVars: __proto__ is not in the theme and has no fallback');
    expect(expandVars('var(constructor, 1px)', {})).toBe('1px');
  });
});
