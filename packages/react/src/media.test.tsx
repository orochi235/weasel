import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { stubMatchMedia } from './testing/stubMatchMedia';
import { matchesMedia, useMediaQuery, watchMedia } from './media';

afterEach(() => { vi.unstubAllGlobals(); });

const stubWide = (wide: boolean) => stubMatchMedia(wide, (query, current) => current && query === '(min-width: 600px)');

describe('matchesMedia', () => {
  it('answers the query, and the fallback with no matchMedia', () => {
    stubWide(true);
    expect(matchesMedia('(min-width: 600px)')).toBe(true);
    expect(matchesMedia('(min-width: 900px)')).toBe(false);
    vi.stubGlobal('matchMedia', undefined);
    expect(matchesMedia('(min-width: 600px)')).toBe(false);
    expect(matchesMedia('(min-width: 600px)', true)).toBe(true);
  });
});

describe('watchMedia', () => {
  it('reports each change until stopped, and is a no-op with no matchMedia', () => {
    const set = stubWide(false);
    const seen = vi.fn();
    const stop = watchMedia('(min-width: 600px)', seen);
    set(true);
    expect(seen).toHaveBeenCalledTimes(1);
    stop();
    expect(set.listeners.size).toBe(0);
    vi.stubGlobal('matchMedia', undefined);
    expect(() => watchMedia('(min-width: 600px)', seen)()).not.toThrow();
  });
});

describe('useMediaQuery', () => {
  it('follows a change, and unsubscribes on unmount', () => {
    const set = stubWide(false);
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 600px)'));
    expect(result.current).toBe(false);
    act(() => set(true));
    expect(result.current).toBe(true);
    unmount();
    expect(set.listeners.size).toBe(0);
  });

  it('subscribes to nothing with follow false', () => {
    const set = stubWide(false);
    renderHook(() => useMediaQuery('(min-width: 600px)', { follow: false }));
    expect(set.listeners.size).toBe(0);
  });

  it('answers the fallback with no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery('(min-width: 600px)', { fallback: true }));
    expect(result.current).toBe(true);
  });
});
