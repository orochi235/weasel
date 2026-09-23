import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useColorModePreference, useResolvedColorMode } from './react';

type Listener = (e: { matches: boolean }) => void;

/** A `(prefers-color-scheme: light)` query the test can flip. */
function fakeSystem(light: boolean) {
  const listeners = new Set<Listener>();
  const mq = {
    matches: light,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mq));
  return {
    listeners,
    set(next: boolean) {
      mq.matches = next;
      for (const l of [...listeners]) l({ matches: next });
    },
  };
}

/** The weasel-ui project's jsdom puts no `localStorage` on the global. */
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

describe('useResolvedColorMode', () => {
  it('returns an explicit mode as given, without subscribing to the OS', () => {
    const sys = fakeSystem(true);
    const { result } = renderHook(() => useResolvedColorMode('dark'));
    expect(result.current).toBe('dark');
    expect(sys.listeners.size).toBe(0);
  });

  it("follows the OS live under 'auto'", () => {
    const sys = fakeSystem(true);
    const { result } = renderHook(() => useResolvedColorMode('auto'));
    expect(result.current).toBe('light');
    act(() => sys.set(false));
    expect(result.current).toBe('dark');
  });

  it('drops the subscription once the preference goes explicit', () => {
    const sys = fakeSystem(false);
    const { rerender } = renderHook(({ p }) => useResolvedColorMode(p), {
      initialProps: { p: 'auto' as 'auto' | 'light' | 'dark' },
    });
    expect(sys.listeners.size).toBe(1);
    rerender({ p: 'light' });
    expect(sys.listeners.size).toBe(0);
  });
});

describe('useColorModePreference', () => {
  it("defaults to 'auto' and resolves it against the OS", () => {
    fakeSystem(false);
    const { result } = renderHook(() => useColorModePreference());
    expect(result.current.preference).toBe('auto');
    expect(result.current.mode).toBe('dark');
  });

  it('takes a different default', () => {
    fakeSystem(false);
    const { result } = renderHook(() => useColorModePreference({ defaultPreference: 'light' }));
    expect(result.current.preference).toBe('light');
    expect(result.current.mode).toBe('light');
  });

  it('switches between all three, including back to auto', () => {
    fakeSystem(true);
    const { result } = renderHook(() => useColorModePreference());
    act(() => result.current.setPreference('dark'));
    expect(result.current.mode).toBe('dark');
    act(() => result.current.setPreference('auto'));
    expect(result.current.preference).toBe('auto');
    expect(result.current.mode).toBe('light');
  });

  it('persists under storageKey and reads it back on the next mount', () => {
    fakeSystem(true);
    const first = renderHook(() => useColorModePreference({ storageKey: 'app-mode' }));
    act(() => first.result.current.setPreference('dark'));
    expect(storage.getItem('app-mode')).toBe('dark');
    first.unmount();
    const second = renderHook(() => useColorModePreference({ storageKey: 'app-mode' }));
    expect(second.result.current.preference).toBe('dark');
  });

  it('ignores a stored value that is not a preference', () => {
    fakeSystem(true);
    storage.setItem('app-mode', 'sepia');
    const { result } = renderHook(() => useColorModePreference({ storageKey: 'app-mode' }));
    expect(result.current.preference).toBe('auto');
  });

  it('still works when storage throws', () => {
    fakeSystem(true);
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    const { result } = renderHook(() => useColorModePreference({ storageKey: 'app-mode' }));
    expect(result.current.preference).toBe('auto');
    act(() => result.current.setPreference('dark'));
    expect(result.current.mode).toBe('dark');
  });

  it('reads and writes a storage the caller supplies', () => {
    fakeSystem(true);
    const own = memoryStorage();
    own.setItem('k', 'light');
    const { result } = renderHook(() => useColorModePreference({ storageKey: 'k', storage: own }));
    expect(result.current.preference).toBe('light');
    act(() => result.current.setPreference('auto'));
    expect(own.getItem('k')).toBe('auto');
    expect(storage.getItem('k')).toBeNull();
  });
});
