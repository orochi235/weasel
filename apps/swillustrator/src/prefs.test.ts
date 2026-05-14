import { describe, expect, it, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PREFS_KEY, usePref } from './prefs';

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

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const ls = () => window.localStorage;

describe('usePref', () => {
  beforeEach(() => {
    ls().clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the registry default when storage is empty', () => {
    const { result } = renderHook(() => usePref('view.gridDensity'));
    expect(result.current[0]).toBe(72);
  });

  it('reads a stored value on mount, walking the nested path', () => {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ version: 2, view: { gridDensity: 12 } }),
    );
    const { result } = renderHook(() => usePref('view.gridDensity'));
    expect(result.current[0]).toBe(12);
  });

  it('writes back to storage at the nested path', async () => {
    const { result } = renderHook(() => usePref('view.gridDensity'));
    act(() => { result.current[1](16); });
    await flushMicrotasks();
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY)!);
    expect(parsed).toEqual({ version: 2, view: { gridDensity: 16 } });
  });

  it('preserves unrelated fields and sibling branches on write', async () => {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        version: 2,
        ui: { rightSidebarWidth: 300 },
        view: { gridDensity: 8, gridVisible: false },
      }),
    );
    const { result } = renderHook(() => usePref('view.gridDensity'));
    act(() => { result.current[1](20); });
    await flushMicrotasks();
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY)!);
    expect(parsed.ui.rightSidebarWidth).toBe(300);
    expect(parsed.view.gridDensity).toBe(20);
    expect(parsed.view.gridVisible).toBe(false);
  });

  it('ignores blobs with a non-matching version', () => {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ version: 1, gridDensity: 99 }),
    );
    const { result } = renderHook(() => usePref('view.gridDensity'));
    expect(result.current[0]).toBe(72);
  });

  it('tolerates corrupted JSON', () => {
    window.localStorage.setItem(PREFS_KEY, '{not json at all');
    const { result } = renderHook(() => usePref('view.gridDensity'));
    expect(result.current[0]).toBe(72);
  });

  it('tolerates localStorage throwing on read', () => {
    const original = window.localStorage.getItem.bind(window.localStorage);
    window.localStorage.getItem = () => { throw new Error('blocked'); };
    try {
      const { result } = renderHook(() => usePref('view.gridDensity'));
      expect(result.current[0]).toBe(72);
    } finally {
      window.localStorage.getItem = original;
    }
  });

  it('supports functional updates', async () => {
    const { result } = renderHook(() => usePref('view.gridDensity'));
    act(() => { result.current[1]((p) => p + 1); });
    await flushMicrotasks();
    expect(result.current[0]).toBe(73);
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY)!);
    expect(parsed.view.gridDensity).toBe(73);
  });

  it('boolean pref round-trips', async () => {
    const { result } = renderHook(() => usePref('view.gridVisible'));
    expect(result.current[0]).toBe(true);
    act(() => { result.current[1](false); });
    await flushMicrotasks();
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY)!);
    expect(parsed.view.gridVisible).toBe(false);
  });

  it('object pref round-trips', async () => {
    const { result } = renderHook(() => usePref('ui.panels'));
    expect(result.current[0]).toEqual({});
    act(() => { result.current[1]({ colors: { hidden: true } }); });
    await flushMicrotasks();
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY)!);
    expect(parsed.ui.panels).toEqual({ colors: { hidden: true } });
  });
});
