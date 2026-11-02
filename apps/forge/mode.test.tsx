import { stubColorScheme } from '@weasel-js/react/testing/stubColorScheme';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { followScheme, resolveMode, useResolvedMode } from './mode';

afterEach(() => vi.unstubAllGlobals());

describe('resolveMode', () => {
  it('keeps an explicit mode and resolves auto, or no mode, from the OS', () => {
    expect([
      resolveMode('light', 'dark'),
      resolveMode('dark', 'light'),
      resolveMode('auto', 'dark'),
      resolveMode('auto', 'light'),
      resolveMode(undefined, 'light'),
    ]).toEqual(['light', 'dark', 'dark', 'light', 'light']);
  });
});

describe('followScheme', () => {
  const target = (root: HTMLElement) => ({ root, scope: `#${root.id}`, style: () => {} });

  it('applies with the resolved mode, and applies the last globals again when the OS scheme changes', () => {
    const flip = stubColorScheme('light');
    const apply = vi.fn();
    const root = document.createElement('div');
    document.body.append(root);
    const applyGlobals = followScheme(apply);
    flip('dark');
    expect(apply).not.toHaveBeenCalled();
    const t = target(root);
    applyGlobals({ mode: 'auto' }, t);
    expect(apply).toHaveBeenLastCalledWith({ mode: 'auto' }, t, 'dark');
    flip('light');
    expect(apply).toHaveBeenLastCalledWith({ mode: 'auto' }, t, 'light');
    expect(apply).toHaveBeenCalledTimes(2);
    root.remove();
  });

  it('follows the scheme for every target it has applied to, and forgets one that left the document', () => {
    const flip = stubColorScheme('light');
    const apply = vi.fn();
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    const applyGlobals = followScheme(apply);
    const ta = target(a);
    const tb = target(b);
    applyGlobals({ mode: 'auto' }, ta);
    applyGlobals({ mode: 'light' }, tb);
    apply.mockClear();
    flip('dark');
    expect(apply.mock.calls).toEqual([
      [{ mode: 'auto' }, ta, 'dark'],
      [{ mode: 'light' }, tb, 'light'],
    ]);
    b.remove();
    apply.mockClear();
    flip('light');
    expect(apply.mock.calls).toEqual([[{ mode: 'auto' }, ta, 'light']]);
    a.remove();
  });

  it('resolves auto to dark with no matchMedia, as the theme does', () => {
    vi.stubGlobal('matchMedia', undefined);
    const apply = vi.fn();
    const root = document.createElement('div');
    followScheme(apply)({ mode: 'auto' }, target(root));
    expect(apply).toHaveBeenLastCalledWith({ mode: 'auto' }, expect.anything(), 'dark');
  });
});

describe('useResolvedMode', () => {
  it('follows the OS scheme while the pick is auto', () => {
    const flip = stubColorScheme('dark');
    const { result, rerender, unmount } = renderHook(({ picked }) => useResolvedMode(picked), {
      initialProps: { picked: 'auto' as unknown },
    });
    expect(result.current).toBe('dark');
    act(() => flip('light'));
    expect(result.current).toBe('light');
    rerender({ picked: 'dark' });
    expect(result.current).toBe('dark');
    unmount();
    expect(flip.listeners.size).toBe(0);
  });
});
