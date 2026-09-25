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
  const target = (root: HTMLElement) => ({ root, scope: `#${root.id}`, style: () => {} });

  it('applies with the resolved mode, and applies the last globals again when the OS scheme changes', () => {
    const { media, flip } = fakeScheme(false);
    const apply = vi.fn();
    const root = document.createElement('div');
    document.body.append(root);
    const applyGlobals = followScheme(apply, media);
    flip(true);
    expect(apply).not.toHaveBeenCalled();
    const t = target(root);
    applyGlobals({ mode: 'auto' }, t);
    expect(apply).toHaveBeenLastCalledWith({ mode: 'auto' }, t, 'dark');
    flip(false);
    expect(apply).toHaveBeenLastCalledWith({ mode: 'auto' }, t, 'light');
    expect(apply).toHaveBeenCalledTimes(2);
    root.remove();
  });

  it('follows the scheme for every target it has applied to, and forgets one that left the document', () => {
    const { media, flip } = fakeScheme(false);
    const apply = vi.fn();
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    const applyGlobals = followScheme(apply, media);
    const ta = target(a);
    const tb = target(b);
    applyGlobals({ mode: 'auto' }, ta);
    applyGlobals({ mode: 'light' }, tb);
    apply.mockClear();
    flip(true);
    expect(apply.mock.calls).toEqual([
      [{ mode: 'auto' }, ta, 'dark'],
      [{ mode: 'light' }, tb, 'light'],
    ]);
    b.remove();
    apply.mockClear();
    flip(false);
    expect(apply.mock.calls).toEqual([[{ mode: 'auto' }, ta, 'light']]);
    a.remove();
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
