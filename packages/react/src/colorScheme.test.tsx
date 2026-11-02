import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { stubColorScheme } from './testing/stubColorScheme';
import { DEFAULT_COLOR_SCHEME, systemColorScheme, useSystemColorScheme, watchColorScheme } from './colorScheme';

afterEach(() => { vi.unstubAllGlobals(); });

describe('systemColorScheme', () => {
  it('answers the media query', () => {
    stubColorScheme('light');
    expect(systemColorScheme()).toBe('light');
    stubColorScheme('dark');
    expect(systemColorScheme()).toBe('dark');
  });

  it('is dark with no matchMedia, and with no stated preference', () => {
    expect(DEFAULT_COLOR_SCHEME).toBe('dark');
    vi.stubGlobal('matchMedia', undefined);
    expect(systemColorScheme()).toBe('dark');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(systemColorScheme()).toBe('dark');
  });
});

describe('watchColorScheme', () => {
  it('hears a change until stopped, and is a no-op with no matchMedia', () => {
    const set = stubColorScheme('dark');
    const fn = vi.fn();
    const stop = watchColorScheme(fn);
    set('light');
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
    expect(set.listeners.size).toBe(0);
    vi.stubGlobal('matchMedia', undefined);
    expect(() => watchColorScheme(fn)()).not.toThrow();
  });
});

describe('useSystemColorScheme', () => {
  it('follows a change to the scheme', () => {
    const set = stubColorScheme('dark');
    const { result } = renderHook(() => useSystemColorScheme());
    expect(result.current).toBe('dark');
    act(() => set('light'));
    expect(result.current).toBe('light');
  });

  it('subscribes to nothing when told not to follow', () => {
    const set = stubColorScheme('light');
    const { result } = renderHook(() => useSystemColorScheme(false));
    expect(result.current).toBe('light');
    expect(set.listeners.size).toBe(0);
  });
});
