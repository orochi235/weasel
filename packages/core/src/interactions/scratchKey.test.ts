import { describe, it, expect } from 'vitest';
import { scratchKey, getScratch, setScratch, deleteScratch } from './scratchKey';

describe('scratchKey / getScratch / setScratch', () => {
  it('round-trips a value through a typed key', () => {
    const KEY = scratchKey<{ count: number }>('test.value');
    const store: Record<string, unknown> = {};
    setScratch(store, KEY, { count: 7 });
    const v = getScratch(store, KEY);
    expect(v).toEqual({ count: 7 });
  });

  it('returns undefined for an unwritten key', () => {
    const KEY = scratchKey<number>('test.unset');
    const store: Record<string, unknown> = {};
    expect(getScratch(store, KEY)).toBeUndefined();
  });

  it('two keys with the same name share a slot at runtime', () => {
    // The type parameter is a compile-time contract; same name = same slot.
    const A = scratchKey<number>('shared');
    const B = scratchKey<number>('shared');
    const store: Record<string, unknown> = {};
    setScratch(store, A, 42);
    expect(getScratch(store, B)).toBe(42);
  });

  it('different names address different slots', () => {
    const A = scratchKey<number>('a');
    const B = scratchKey<number>('b');
    const store: Record<string, unknown> = {};
    setScratch(store, A, 1);
    setScratch(store, B, 2);
    expect(getScratch(store, A)).toBe(1);
    expect(getScratch(store, B)).toBe(2);
  });

  it('deleteScratch removes a slot and returns true', () => {
    const KEY = scratchKey<string>('test.deletable');
    const store: Record<string, unknown> = {};
    setScratch(store, KEY, 'hello');
    expect(deleteScratch(store, KEY)).toBe(true);
    expect(getScratch(store, KEY)).toBeUndefined();
  });

  it('deleteScratch returns false when the key was not set', () => {
    const KEY = scratchKey<string>('test.never-set');
    const store: Record<string, unknown> = {};
    expect(deleteScratch(store, KEY)).toBe(false);
  });

  it('reads existing untyped data when the key name matches', () => {
    // Migration path: typed reads work on stores populated by old-style
    // `store[name] = value` writes.
    const store: Record<string, unknown> = { 'legacy.key': 99 };
    const KEY = scratchKey<number>('legacy.key');
    expect(getScratch(store, KEY)).toBe(99);
  });
});
