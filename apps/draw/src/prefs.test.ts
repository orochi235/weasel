import { describe, expect, it, beforeEach, beforeAll, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { prefLeaves, type PrefGroup, VERSION_RECORD } from '@weasel-js/prefs';
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

  it('keeps the legacy key outside the store\'s prefix', () => {
    expect(LEGACY_PREFS_KEY.startsWith(PREFS_PREFIX)).toBe(false);
  });

  it('leaves only leaf records under the prefix after import', async () => {
    window.localStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify({ version: 2, view: { gridDensity: 40 } }));
    const backing = new Map<string, unknown>([[LEGACY_PREFS_KEY, { version: 2 }]]);
    const store = openDrawPrefs(createMemoryAdapter(backing));
    importLegacyPrefs(store, window.localStorage);
    await store.flush();
    const records = [...backing.keys()].filter((k) => k.startsWith(PREFS_PREFIX));
    expect(records).toEqual([`${PREFS_PREFIX}view.gridDensity`]);
  });

  it('copies every leaf of the v2 blob into the store', () => {
    window.localStorage.setItem(
      LEGACY_PREFS_KEY,
      JSON.stringify({ version: 2, view: { gridDensity: 40, gridVisible: false }, stray: 1 }),
    );
    const store = openDrawPrefs(createMemoryAdapter());
    importLegacyPrefs(store, window.localStorage);
    expect(store.get('view.gridDensity')).toBe(40);
    expect(store.get('view.gridVisible')).toBe(false);
  });

  it('removes the blob only once the new records are on disk', async () => {
    window.localStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify({ version: 2, view: { gridDensity: 40 } }));
    const backing = new Map<string, unknown>();
    const store = openDrawPrefs(createMemoryAdapter(backing));
    importLegacyPrefs(store, window.localStorage);
    expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).not.toBeNull();
    await vi.waitFor(() => expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).toBeNull());
    expect(backing.get(`${PREFS_PREFIX}view.gridDensity`)).toBe(40);
  });

  it('leaves the blob in place when the store cannot persist', async () => {
    const blob = JSON.stringify({ version: 2, view: { gridDensity: 40 } });
    window.localStorage.setItem(LEGACY_PREFS_KEY, blob);
    const store = openDrawPrefs(createMemoryAdapter(new Map([[`${PREFS_PREFIX}${VERSION_RECORD}`, 99]])));
    expect(store.writable).toBe(false);
    importLegacyPrefs(store, window.localStorage);
    await store.flush();
    await Promise.resolve();
    expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).toBe(blob);
    expect(store.isSet('view.gridDensity')).toBe(false);
  });

  it('leaves the blob in place when the new records fail to write', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const blob = JSON.stringify({ version: 2, view: { gridDensity: 40 } });
    window.localStorage.setItem(LEGACY_PREFS_KEY, blob);
    const failing = { ...createMemoryAdapter(), set: () => Promise.reject(new Error('quota')) };
    const store = openDrawPrefs(failing);
    importLegacyPrefs(store, window.localStorage);
    await new Promise((r) => setTimeout(r, 0));
    expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).toBe(blob);
    warn.mockRestore();
  });

  it('neither imports nor removes a blob of another version', async () => {
    const blob = JSON.stringify({ version: 1, view: { gridDensity: 40 } });
    window.localStorage.setItem(LEGACY_PREFS_KEY, blob);
    const store = openDrawPrefs(createMemoryAdapter());
    importLegacyPrefs(store, window.localStorage);
    await store.flush();
    await Promise.resolve();
    expect(store.isSet('view.gridDensity')).toBe(false);
    expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).toBe(blob);
  });

  it('does not overwrite a leaf the store already holds', () => {
    window.localStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify({ version: 2, view: { gridDensity: 40 } }));
    const store = openDrawPrefs(createMemoryAdapter(new Map([[`${PREFS_PREFIX}view.gridDensity`, 8]])));
    importLegacyPrefs(store, window.localStorage);
    expect(store.get('view.gridDensity')).toBe(8);
  });

  it('drops a blob it cannot parse, storing nothing', async () => {
    window.localStorage.setItem(LEGACY_PREFS_KEY, '{not json');
    const store = openDrawPrefs(createMemoryAdapter());
    importLegacyPrefs(store, window.localStorage);
    expect(store.unset().size).toBe(prefLeaves(PREFS).size);
    await vi.waitFor(() => expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).toBeNull());
  });
});

describe('draw validators', () => {
  it('reads a non-string last tool as the default', () => {
    const store = openDrawPrefs(createMemoryAdapter(new Map([[`${PREFS_PREFIX}tools.lastTool`, 5]])));
    expect(store.get('tools.lastTool')).toBe('select');
  });

  it('passes a data pref through as stored', () => {
    const panels = { layers: { hidden: true } };
    const store = openDrawPrefs(createMemoryAdapter(new Map([[`${PREFS_PREFIX}ui.panels`, panels]])));
    expect(store.get('ui.panels')).toEqual(panels);
  });
});

describe('usePref', () => {
  it('binds a leaf of the app store', () => {
    const { result } = renderHook(() => usePref('view.snapToGrid'));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});
