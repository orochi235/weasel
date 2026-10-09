import { describe, expect, it, beforeEach, beforeAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { createMemoryAdapter } from '@weasel-js/storage';
import {
  LEGACY_PREFS_KEY,
  PREFS,
  PREFS_PREFIX,
  importLegacyPrefs,
  openDrawPrefs,
  usePref,
} from './prefs';

// jsdom 26 + Node 26 currently leaves `window.localStorage` returning
// `undefined` from its native getter. Swap in a plain in-memory Storage so
// the hook (and any kit code that reads bare `localStorage`) sees a working
// store. The shim is installed once per file before any hook mounts.
beforeAll(() => {
  if (typeof window !== 'undefined' && !window.localStorage) {
    const store = new Map<string, string>();
    const fakeStorage: Storage = {
      get length() { return store.size; },
      clear: () => store.clear(),
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => { store.delete(k); },
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => fakeStorage,
    });
  }
});

describe('PREFS', () => {
  it('assigns to PrefGroup without a cast', () => {
    const asGroup: PrefGroup = PREFS;
    expect(asGroup.children.view).toBeDefined();
  });

  it('stores the panel map under the custom data kind', () => {
    expect(PREFS.children.ui.children.panels.kind).toBe('data');
  });
});

describe('openDrawPrefs', () => {
  it('reads a stored leaf by its path', () => {
    const backing = new Map<string, unknown>([[`${PREFS_PREFIX}view.gridDensity`, 40]]);
    const store = openDrawPrefs(createMemoryAdapter(backing));
    expect(store.get('view.gridDensity')).toBe(40);
    expect(store.get('view.gridVisible')).toBe(true);
  });

  it('round-trips a tool-contributed pref at its composed path', async () => {
    const backing = new Map<string, unknown>();
    const store = openDrawPrefs(createMemoryAdapter(backing));
    store.set('tools.pen.autoCommitOnClose', false);
    await store.flush();
    expect(backing.get(`${PREFS_PREFIX}tools.pen.autoCommitOnClose`)).toBe(false);
  });

  it('holds any tool id as the last tool', () => {
    const store = openDrawPrefs(createMemoryAdapter());
    store.set('tools.lastTool', 'pen');
    expect(store.get('tools.lastTool')).toBe('pen');
  });
});

describe('importLegacyPrefs', () => {
  beforeEach(() => window.localStorage.clear());

  it('copies every leaf of the v2 blob into the store, then removes the blob', () => {
    window.localStorage.setItem(
      LEGACY_PREFS_KEY,
      JSON.stringify({ version: 2, view: { gridDensity: 40, gridVisible: false }, stray: 1 }),
    );
    const store = openDrawPrefs(createMemoryAdapter());
    importLegacyPrefs(store, window.localStorage);
    expect(store.get('view.gridDensity')).toBe(40);
    expect(store.get('view.gridVisible')).toBe(false);
    expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).toBeNull();
  });

  it('does not overwrite a leaf the store already holds', () => {
    window.localStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify({ version: 2, view: { gridDensity: 40 } }));
    const store = openDrawPrefs(createMemoryAdapter(new Map([[`${PREFS_PREFIX}view.gridDensity`, 8]])));
    importLegacyPrefs(store, window.localStorage);
    expect(store.get('view.gridDensity')).toBe(8);
  });

  it('drops a blob it cannot parse', () => {
    window.localStorage.setItem(LEGACY_PREFS_KEY, '{not json');
    const store = openDrawPrefs(createMemoryAdapter());
    importLegacyPrefs(store, window.localStorage);
    expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).toBeNull();
    expect(store.unset().size).toBeGreaterThan(0);
  });
});

describe('usePref', () => {
  it('binds a leaf of the app store', () => {
    const { result } = renderHook(() => usePref('view.snapToGrid'));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});
