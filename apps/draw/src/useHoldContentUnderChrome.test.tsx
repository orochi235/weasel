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

    const { rerender } = renderHook(({ shown }) => useHoldContentUnderChrome(ref, setView, shown), {
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
});
