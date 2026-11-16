import { describe, expect, it } from 'vitest';
import { getOwn, hasOwnKey } from './getOwn';

describe('getOwn', () => {
  it('reads an own key, and a key named like an Object.prototype member as absent', () => {
    const table: Record<string, number> = { a: 1 };
    expect(getOwn(table, 'a')).toBe(1);
    expect(getOwn(table, 'b')).toBeUndefined();
    expect(getOwn(table, 'constructor')).toBeUndefined();
    expect(getOwn(table, 'toString')).toBeUndefined();
    expect(getOwn(table, '__proto__')).toBeUndefined();
  });

  it('reads such a key when the record holds it itself', () => {
    const table = JSON.parse('{"__proto__": 2, "toString": 3}') as Record<string, number>;
    expect(getOwn(table, '__proto__')).toBe(2);
    expect(getOwn(table, 'toString')).toBe(3);
    expect(getOwn(Object.create(null) as Record<string, number>, 'toString')).toBeUndefined();
  });

  it('reads nothing from no record', () => {
    expect(getOwn(undefined, 'a')).toBeUndefined();
    expect(getOwn(null, 'a')).toBeUndefined();
  });
});

describe('hasOwnKey', () => {
  it('counts only own keys', () => {
    const table = { light: 1, dark: 2 } as const;
    expect(hasOwnKey(table, 'light')).toBe(true);
    expect(hasOwnKey(table, 'constructor')).toBe(false);
    expect(hasOwnKey(table, 'hasOwnProperty')).toBe(false);
  });
});
