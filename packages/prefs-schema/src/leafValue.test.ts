import { describe, expect, it } from 'vitest';
import { prefValueOrDefault, prefValueAbsent } from './leafValue';
import type { PrefLeaf } from './schema';

const number = { kind: 'number', name: 'Gap', description: '', default: 4 } as PrefLeaf;
const clearable = { kind: 'number', name: 'Gap', description: '', default: 4, clearable: true } as PrefLeaf;
const paint = { kind: 'paint', name: 'Fill', description: '', default: { kind: 'solid', color: '#fff' } } as PrefLeaf;

describe('prefValueOrDefault', () => {
  it('shows a held value', () => {
    expect(prefValueOrDefault(number, 7)).toBe(7);
    expect(prefValueOrDefault(number, 0)).toBe(0);
  });

  it('shows the default for undefined and for null', () => {
    expect(prefValueOrDefault(number, undefined)).toBe(4);
    expect(prefValueOrDefault(number, null)).toBe(4);
  });

  it("keeps a paint's null, which is no paint", () => {
    expect(prefValueOrDefault(paint, null)).toBeNull();
    expect(prefValueOrDefault(paint, undefined)).toEqual({ kind: 'solid', color: '#fff' });
  });

  it('shows a clearable leaf holding nothing as cleared, not as its default', () => {
    expect(prefValueOrDefault(clearable, undefined)).toBeUndefined();
    expect(prefValueOrDefault(clearable, null)).toBeUndefined();
    expect(prefValueOrDefault(clearable, 2)).toBe(2);
  });

  it('shows nothing where the caller says absence is unset', () => {
    expect(prefValueOrDefault(number, undefined, { unset: true })).toBeUndefined();
    expect(prefValueOrDefault(number, null, { unset: true })).toBeUndefined();
    expect(prefValueOrDefault(number, 7, { unset: true })).toBe(7);
  });
});

describe('prefValueAbsent', () => {
  it('reads undefined and null as absent, but not a paint\'s null', () => {
    expect(prefValueAbsent(number, undefined)).toBe(true);
    expect(prefValueAbsent(number, null)).toBe(true);
    expect(prefValueAbsent(number, 0)).toBe(false);
    expect(prefValueAbsent(paint, null)).toBe(false);
    expect(prefValueAbsent(paint, undefined)).toBe(true);
  });
});
