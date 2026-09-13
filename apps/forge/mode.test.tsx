import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { followScheme, resolveMode, useResolvedMode } from './mode';

/** A `prefers-color-scheme: dark` query whose answer the test flips. */
function fakeScheme(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: dark,
    addEventListener: (_: 'change', fn: () => void) => listeners.add(fn),
    removeEventListener: (_: 'change', fn: () => void) => listeners.delete(fn),
  };
  const flip = (next: boolean) => {
    media.matches = next;
    for (const fn of [...listeners]) fn();
  };
  return { media: media as unknown as MediaQueryList, flip, listeners };
}

describe('resolveMode', () => {
  it('keeps an explicit mode and resolves auto, or no mode, from the OS', () => {
    expect([
      resolveMode('light', true),
      resolveMode('dark', false),
      resolveMode('auto', true),
      resolveMode('auto', false),
      resolveMode(undefined, false),
    ]).toEqual(['light', 'dark', 'dark', 'light', 'light']);
  });
});

describe('followScheme', () => {
  it('applies with the resolved mode, and applies the last globals again when the OS scheme changes', () => {
    const { media, flip } = fakeScheme(false);
    const apply = vi.fn();
    const root = document.createElement('div');
    const applyGlobals = followScheme(apply, media);
    flip(true);
    expect(apply).not.toHaveBeenCalled();
    applyGlobals({ mode: 'auto' }, root);
    expect(apply).toHaveBeenLastCalledWith({ mode: 'auto' }, root, 'dark');
    flip(false);
    expect(apply).toHaveBeenLastCalledWith({ mode: 'auto' }, root, 'light');
    expect(apply).toHaveBeenCalledTimes(2);
  });
});

describe('useResolvedMode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows the OS scheme while the pick is auto', () => {
    const { media, flip, listeners } = fakeScheme(true);
    vi.stubGlobal('matchMedia', () => media);
    const { result, rerender, unmount } = renderHook(({ picked }) => useResolvedMode(picked), {
      initialProps: { picked: 'auto' as unknown },
    });
    expect(result.current).toBe('dark');
    act(() => flip(false));
    expect(result.current).toBe('light');
    rerender({ picked: 'dark' });
    expect(result.current).toBe('dark');
    unmount();
    expect(listeners.size).toBe(0);
  });
});
