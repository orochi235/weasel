import { act, renderHook } from '@testing-library/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import { usePref, usePrefsValues } from './react';
import { openPrefsSync } from './open';
import type { PrefGroup } from './groups';

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

  it('composes two functional updates in one act', () => {
    const store = open();
    const { result } = renderHook(() => usePref(store, 'density'));
    act(() => {
      result.current[1]((d) => d + 1);
      result.current[1]((d) => d + 1);
    });
    expect(result.current[0]).toBe(74);
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

  it('returns the raw stored records, and hears an orphan record change', async () => {
    const backing = new Map<string, unknown>([['p.stray', 'x']]);
    const store = openPrefsSync(SCHEMA, { storage: createMemoryAdapter(backing), prefix: 'p.' });
    const { result } = renderHook(() => usePrefsValues(store));
    expect(result.current.stored).toEqual({ stray: 'x' });
    await act(async () => {
      await createMemoryAdapter(backing).set('p.other', 2);
      await Promise.resolve();
    });
    expect(result.current.stored).toEqual({ stray: 'x', other: 2 });
  });

  it('returns the loci, and a split, a join, and a write at a selection, for PrefsForm', () => {
    const schema = {
      name: 'Split',
      children: {
        mode: {
          kind: 'enum', name: 'Mode', description: '', default: 'dark',
          options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }],
        },
        gap: { kind: 'number', name: 'Gap', description: '', default: 4, splitBy: ['mode'] },
      },
    } satisfies PrefGroup;
    const store = openPrefsSync(schema, { storage: createMemoryAdapter(), prefix: 'p.' });
    const { result } = renderHook(() => usePrefsValues(store));
    const empty = result.current.loci;
    expect(empty.size).toBe(0);
    act(() => result.current.split('gap', 'mode'));
    expect(result.current.loci.get('gap')).toEqual({ $by: 'mode', $of: { dark: 4, light: 4 } });
    act(() => result.current.setAt('gap', 9, { mode: 'light' }));
    expect(result.current.loci.get('gap')).toEqual({ $by: 'mode', $of: { dark: 4, light: 9 } });
    expect(result.current.values.gap).toBe(4);
    const held = result.current.loci;
    act(() => result.current.set('mode', 'light'));
    expect(result.current.values.gap).toBe(9);
    expect(result.current.loci.get('gap')).toBe(held.get('gap'));
    act(() => result.current.join('gap', 'mode'));
    expect(result.current.loci.size).toBe(0);
    expect(result.current.values.gap).toBe(9);
  });
});
