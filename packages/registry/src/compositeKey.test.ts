import { describe, expect, it } from 'vitest';
import { compositeKey } from './compositeKey';

describe('compositeKey', () => {
  it('keeps apart tuples whose parts run together under a separator', () => {
    expect(['a:b', 'c'].join(':')).toBe(['a', 'b:c'].join(':'));
    expect(compositeKey(['a:b', 'c'])).not.toBe(compositeKey(['a', 'b:c']));
    expect(compositeKey(['1:a', ''])).not.toBe(compositeKey(['', '1:a']));
    expect(compositeKey(['ab'])).not.toBe(compositeKey(['a', 'b']));
  });

  it('writes a number, a boolean, null, and undefined apart from the string that names it', () => {
    const keys = [compositeKey([1]), compositeKey(['1']), compositeKey([true]), compositeKey(['t']), compositeKey([null]), compositeKey(['null']), compositeKey([undefined]), compositeKey([''])];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives equal tuples one key, and 0 and -0 the same one', () => {
    expect(compositeKey(['x', 2, null])).toBe(compositeKey(['x', 2, null]));
    expect(compositeKey([-0])).toBe(compositeKey([0]));
  });
});
