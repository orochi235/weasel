import { renderHook } from '@testing-library/react';
import type { View } from '@weasel-js/core';
import { describe, expect, it, vi } from 'vitest';
import { useHoldContentUnderChrome } from './useHoldContentUnderChrome';

describe('useHoldContentUnderChrome', () => {
  it('pans the view as far as the strip grew or shrank, in world units', () => {
    // jsdom has no layout, so the strip's height is stubbed.
    const el = document.createElement('div');
    let height = 0;
    el.getBoundingClientRect = () => ({ height } as DOMRect);
    const ref = { current: el };
    let view: View = { x: 0, y: 10, scale: { x: 2, y: 2 } };
    const setView = vi.fn((next: View | ((v: View) => View)) => {
      view = typeof next === 'function' ? next(view) : next;
    });

    const { rerender } = renderHook(({ shown }) => useHoldContentUnderChrome(ref, setView, shown ? 'strip' : ''), {
      initialProps: { shown: false },
    });
    expect(setView).not.toHaveBeenCalled();

    height = 32;
    rerender({ shown: true });
    expect(view.y).toBe(26);

    height = 0;
    rerender({ shown: false });
    expect(view.y).toBe(10);
  });

  it('pans when a row joins a strip that was already shown', () => {
    const el = document.createElement('div');
    let height = 32;
    el.getBoundingClientRect = () => ({ height } as DOMRect);
    let view: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const setView = vi.fn((next: View | ((v: View) => View)) => {
      view = typeof next === 'function' ? next(view) : next;
    });
    const { rerender } = renderHook(({ rows }) => useHoldContentUnderChrome({ current: el }, setView, rows), {
      initialProps: { rows: 'tool' },
    });
    height = 64;
    rerender({ rows: 'character tool' });
    expect(view.y).toBe(32);
  });
});
