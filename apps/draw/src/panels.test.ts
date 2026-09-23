import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { migrateLegacyPanelFlags, usePanel } from './panels';
import { PREFS_KEY, readPref } from './prefs';

// Same in-memory Storage shim as prefs.test.ts: jsdom 26 + Node 26 can
// leave `window.localStorage` undefined.
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
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => fakeStorage });
  }
});

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('usePanel', () => {
  beforeEach(async () => { await flush(); window.localStorage.clear(); });

  it('toggles collapsed and hides through ui.panels', async () => {
    const { result } = renderHook(() => usePanel('layers'));
    expect(result.current).toMatchObject({ hidden: false, collapsed: false });
    act(() => { result.current.onToggleCollapse(); });
    expect(result.current.collapsed).toBe(true);
    act(() => { result.current.onHide(); });
    expect(result.current.hidden).toBe(true);
    await flush();
    expect(JSON.parse(window.localStorage.getItem(PREFS_KEY)!).ui.panels)
      .toEqual({ layers: { collapsed: true, hidden: true } });
  });

  it('keeps panels independent', () => {
    const layers = renderHook(() => usePanel('layers'));
    const history = renderHook(() => usePanel('history'));
    act(() => { layers.result.current.onToggleCollapse(); });
    expect(history.result.current.collapsed).toBe(false);
    expect(layers.result.current.collapsed).toBe(true);
  });
});

describe('migrateLegacyPanelFlags', () => {
  beforeEach(async () => { await flush(); window.localStorage.clear(); });

  it('folds wd:panel:*:collapsed into ui.panels and removes the old keys', async () => {
    window.localStorage.setItem('wd:panel:layers:collapsed', '1');
    window.localStorage.setItem('wd:panel:history:collapsed', '0');
    migrateLegacyPanelFlags(window.localStorage);
    expect(readPref('ui.panels')).toEqual({
      layers: { collapsed: true },
      history: { collapsed: false },
    });
    expect(window.localStorage.getItem('wd:panel:layers:collapsed')).toBeNull();
    expect(window.localStorage.getItem('wd:panel:history:collapsed')).toBeNull();
  });

  it('does not overwrite a value already in ui.panels', async () => {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ version: 2, ui: { panels: { layers: { collapsed: false } } } }));
    window.localStorage.setItem('wd:panel:layers:collapsed', '1');
    migrateLegacyPanelFlags(window.localStorage);
    expect(readPref('ui.panels')).toEqual({ layers: { collapsed: false } });
  });

  it('is a no-op without legacy keys', async () => {
    migrateLegacyPanelFlags(window.localStorage);
    await flush();
    expect(window.localStorage.getItem(PREFS_KEY)).toBeNull();
  });
});
