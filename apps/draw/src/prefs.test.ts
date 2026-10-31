import { describe, expect, it, beforeEach, beforeAll, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { prefLeaves, VERSION_RECORD } from '@weasel-js/prefs';
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
  it('stores the surface map under the custom data kind', () => {
    expect(PREFS.children.ui.children.surfaces.kind).toBe('data');
  });
});

describe('openDrawPrefs', () => {
  it('reads a stored leaf by its path', () => {
    const backing = new Map<string, unknown>([[`${PREFS_PREFIX}view.gridDensity`, 40]]);
    const store = openDrawPrefs(createMemoryAdapter(backing));
    expect(store.get('view.gridDensity')).toBe(40);
    expect(store.get('view.gridVisible')).toBe(false);
  });

  it('reads a stored surface map that is not a map as its default', () => {
    for (const stored of [null, 'x', 3, [1]]) {
      const backing = new Map<string, unknown>([[`${PREFS_PREFIX}ui.surfaces`, stored]]);
      expect(openDrawPrefs(createMemoryAdapter(backing)).get('ui.surfaces')).toEqual({});
    }
    const backing = new Map<string, unknown>([[`${PREFS_PREFIX}ui.surfaces`, { layers: { hidden: true } }]]);
    expect(openDrawPrefs(createMemoryAdapter(backing)).get('ui.surfaces')).toEqual({ layers: { hidden: true } });
  });

  it('carries the old panel map forward as the surface map', async () => {
    const backing = new Map<string, unknown>([[`${PREFS_PREFIX}ui.panels`, { layers: { hidden: true }, history: { collapsed: true } }]]);
    const store = openDrawPrefs(createMemoryAdapter(backing));
    expect(store.get('ui.surfaces')).toEqual({ layers: { hidden: true }, history: { collapsed: true } });
    await store.flush();
    expect(backing.has(`${PREFS_PREFIX}ui.panels`)).toBe(false);
  });

  it("drops the folded path tools palette's hidden flag from the surface map", () => {
    const backing = new Map<string, unknown>([
      [`${PREFS_PREFIX}ui.surfaces`, { pathTools: { hidden: true }, layers: { collapsed: true } }],
      [`${PREFS_PREFIX}${VERSION_RECORD}`, 1],
    ]);
    expect(openDrawPrefs(createMemoryAdapter(backing)).get('ui.surfaces')).toEqual({ layers: { collapsed: true } });
  });

  it('keeps a surface map already stored over an old panel map', () => {
    const backing = new Map<string, unknown>([
      [`${PREFS_PREFIX}ui.panels`, { layers: { hidden: true } }],
      [`${PREFS_PREFIX}ui.surfaces`, { path: { surface: 'menu' } }],
    ]);
    expect(openDrawPrefs(createMemoryAdapter(backing)).get('ui.surfaces')).toEqual({ path: { surface: 'menu' } });
  });

  it('carries a v2 blob’s panel map forward as the surface map', () => {
    window.localStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify({ version: 2, ui: { panels: { colors: { hidden: true } } } }));
    const store = openDrawPrefs(createMemoryAdapter());
    importLegacyPrefs(store, window.localStorage);
    expect(store.get('ui.surfaces')).toEqual({ colors: { hidden: true } });
  });

  it('round-trips a tool-contributed pref at its composed path', async () => {
    const backing = new Map<string, unknown>();
    const store = openDrawPrefs(createMemoryAdapter(backing));
    store.set('tools.pen.autoCommitOnClose', false);
    await store.flush();
    expect(backing.get(`${PREFS_PREFIX}tools.pen.autoCommitOnClose`)).toEqual({ $at: 2, value: false });
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

  it('leaves only leaf records and the version under the prefix after import', async () => {
    window.localStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify({ version: 2, view: { gridDensity: 40 } }));
    const backing = new Map<string, unknown>([[LEGACY_PREFS_KEY, { version: 2 }]]);
    const store = openDrawPrefs(createMemoryAdapter(backing));
    importLegacyPrefs(store, window.localStorage);
    await store.flush();
    const records = [...backing.keys()].filter((k) => k.startsWith(PREFS_PREFIX));
    expect(records.sort()).toEqual([`${PREFS_PREFIX}$version`, `${PREFS_PREFIX}view.gridDensity`]);
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
    expect(backing.get(`${PREFS_PREFIX}view.gridDensity`)).toEqual({ $at: 2, value: 40 });
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

  it('imports the blob when storage that was away at open comes back', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify({ version: 2, view: { gridDensity: 40 } }));
    const backing = new Map<string, unknown>();
    const memory = createMemoryAdapter(backing);
    let away = true;
    const store = openDrawPrefs({
      ...memory,
      listSync: (prefix) => {
        if (away) throw new Error('storage away');
        return memory.listSync(prefix);
      },
      list: async (prefix) => memory.listSync(prefix),
    });
    expect(store.writable).toBe(false);
    importLegacyPrefs(store, window.localStorage);
    expect(store.isSet('view.gridDensity')).toBe(false);
    away = false;
    await store.read();
    await vi.waitFor(() => expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).toBeNull());
    expect(backing.get(`${PREFS_PREFIX}view.gridDensity`)).toEqual({ $at: 2, value: 40 });
    await store.close();
    warn.mockRestore();
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
});

describe('usePref', () => {
  it('binds a leaf of the app store', () => {
    const { result } = renderHook(() => usePref('view.snapToGrid'));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});
