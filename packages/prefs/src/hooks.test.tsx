import { act, renderHook } from '@testing-library/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import { usePref, usePrefsValues } from './hooks';
import { openPrefsSync } from './open';
import type { PrefGroup } from './schema';

const SCHEMA = {
  name: 'Test',
  children: {
    grid: { kind: 'boolean', name: 'Grid', description: '', default: true },
    density: { kind: 'number', name: 'Density', description: '', default: 72, min: 4, max: 288 },
  },
} satisfies PrefGroup;

const open = () => openPrefsSync(SCHEMA, { storage: createMemoryAdapter(), prefix: 'p.' });

describe('usePref', () => {
  it('reads the leaf and re-renders when it changes', () => {
    const store = open();
    const { result } = renderHook(() => usePref(store, 'density'));
    expect(result.current[0]).toBe(72);
    act(() => result.current[1](100));
    expect(result.current[0]).toBe(100);
    expect(store.get('density')).toBe(100);
  });

  it('takes a functional update', () => {
    const store = open();
    const { result } = renderHook(() => usePref(store, 'density'));
    act(() => result.current[1]((d) => d + 1));
    expect(result.current[0]).toBe(73);
  });

  it('hears a write made through another binding', () => {
    const store = open();
    const a = renderHook(() => usePref(store, 'grid'));
    const b = renderHook(() => usePref(store, 'grid'));
    act(() => a.result.current[1](false));
    expect(b.result.current[0]).toBe(false);
  });
});

describe('usePrefsValues', () => {
  it('returns the tree, the unset paths, a setter and a reset, for PrefsForm', () => {
    const store = open();
    const { result } = renderHook(() => usePrefsValues(store));
    expect(result.current.values).toEqual({ grid: true, density: 72 });
    expect(result.current.unset).toEqual(new Set(['grid', 'density']));
    act(() => result.current.set('grid', false));
    expect(result.current.values).toEqual({ grid: false, density: 72 });
    expect(result.current.unset).toEqual(new Set(['density']));
    act(() => result.current.reset('grid'));
    expect(result.current.values.grid).toBe(true);
  });

  it('hears a leaf binding', () => {
    const store = open();
    const tree = renderHook(() => usePrefsValues(store));
    const leaf = renderHook(() => usePref(store, 'density'));
    act(() => leaf.result.current[1](10));
    expect(tree.result.current.values.density).toBe(10);
  });
});
