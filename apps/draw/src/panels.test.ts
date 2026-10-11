import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest';
import { createMemoryAdapter } from '@weasel-js/storage';
import { renderHook, act } from '@testing-library/react';
import { migrateLegacyPanelFlags, usePanel } from './panels';
import { drawPrefs, openDrawPrefs } from './prefs';

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

describe('usePanel', () => {
  beforeEach(() => {
    drawPrefs().reset();
    window.localStorage.clear();
  });

  it('toggles collapsed and hides through ui.panels', () => {
    const { result } = renderHook(() => usePanel('layers'));
    expect(result.current).toMatchObject({ hidden: false, collapsed: false });
    act(() => { result.current.onToggleCollapse(); });
    expect(result.current.collapsed).toBe(true);
    act(() => { result.current.onHide(); });
    expect(result.current.hidden).toBe(true);
    expect(drawPrefs().get('ui.panels'))
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
  beforeEach(() => {
    drawPrefs().reset();
    window.localStorage.clear();
  });

  it('folds wd:panel:*:collapsed into ui.panels and removes the old keys', async () => {
    window.localStorage.setItem('wd:panel:layers:collapsed', '1');
    window.localStorage.setItem('wd:panel:history:collapsed', '0');
    migrateLegacyPanelFlags(drawPrefs(), window.localStorage);
    expect(drawPrefs().get('ui.panels')).toEqual({
      layers: { collapsed: true },
      history: { collapsed: false },
    });
    await vi.waitFor(() => expect(window.localStorage.getItem('wd:panel:layers:collapsed')).toBeNull());
    expect(window.localStorage.getItem('wd:panel:history:collapsed')).toBeNull();
  });

  it('keeps the old keys while the folded value has not reached storage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = { ...createMemoryAdapter(), set: () => Promise.reject(new Error('quota')) };
    const prefs = openDrawPrefs(failing);
    window.localStorage.setItem('wd:panel:layers:collapsed', '1');
    migrateLegacyPanelFlags(prefs, window.localStorage);
    expect(prefs.get('ui.panels')).toEqual({ layers: { collapsed: true } });
    expect(await prefs.flush()).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(window.localStorage.getItem('wd:panel:layers:collapsed')).toBe('1');
    await prefs.close();
    warn.mockRestore();
  });

  it('does not overwrite a value already in ui.panels', () => {
    drawPrefs().set('ui.panels', { layers: { collapsed: false } });
    window.localStorage.setItem('wd:panel:layers:collapsed', '1');
    migrateLegacyPanelFlags(drawPrefs(), window.localStorage);
    expect(drawPrefs().get('ui.panels')).toEqual({ layers: { collapsed: false } });
  });

  it('is a no-op without legacy keys', () => {
    migrateLegacyPanelFlags(drawPrefs(), window.localStorage);
    expect(drawPrefs().isSet('ui.panels')).toBe(false);
  });
});
