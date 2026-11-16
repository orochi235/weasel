import { describe, expect, it } from 'vitest';
import { prefClampNumber, prefNumberAt } from './bounds';
import { repairPrefValue } from './repair';
import type { PrefNumber } from './schema';

const num = (extra: Partial<PrefNumber> = {}): PrefNumber => ({ kind: 'number', name: 'N', description: '', default: 0, ...extra });

describe('prefNumberAt', () => {
  const read = (values: Record<string, unknown>) => (path: string) => values[path];

  it('raises min to what minAt reads where the value is held, and keeps the larger', () => {
    const leaf = num({ min: 0, minAt: (at) => at('floor') as number | undefined });
    expect(prefNumberAt(leaf, read({ floor: 30 })).min).toBe(30);
    expect(prefNumberAt(leaf, read({ floor: -5 })).min).toBe(0);
    expect(prefNumberAt(leaf, read({})).min).toBe(0);
  });

  it('lowers max to what maxAt reads, and keeps the smaller', () => {
    const leaf = num({ max: 100, maxAt: (at) => at('cap') as number | undefined });
    expect(prefNumberAt(leaf, read({ cap: 40 })).max).toBe(40);
    expect(prefNumberAt(leaf, read({ cap: 400 })).max).toBe(100);
  });

  it('sets a bound the leaf had none of', () => {
    expect(prefNumberAt(num({ minAt: () => 3 }), read({})).min).toBe(3);
  });

  it('hands back a leaf with nothing left to resolve, and the leaf itself when it had nothing', () => {
    const resolved = prefNumberAt(num({ minAt: () => 3, maxAt: () => 9 }), read({}));
    expect(resolved.minAt).toBeUndefined();
    expect(resolved.maxAt).toBeUndefined();
    const plain = num({ min: 1 });
    expect(prefNumberAt(plain, read({}))).toBe(plain);
  });
});

describe('prefClampNumber', () => {
  it('holds a number to the leaf\'s min and max', () => {
    expect(prefClampNumber(num({ min: 2, max: 8 }), 1)).toBe(2);
    expect(prefClampNumber(num({ min: 2, max: 8 }), 9)).toBe(8);
    expect(prefClampNumber(num({ min: 2, max: 8 }), 5)).toBe(5);
  });

  it('lets through the infinity an endless end stands for', () => {
    expect(prefClampNumber(num({ max: 8, endless: 'max' }), Infinity)).toBe(Infinity);
    expect(prefClampNumber(num({ max: 8 }), Infinity)).toBe(8);
  });

  it('is the clamp a stored value is repaired by', () => {
    expect(repairPrefValue(num({ min: 2, max: 8 }), 1)).toBe(2);
  });
});
