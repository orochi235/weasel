import { renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { useLatestOnly } from './useLatestOnly';

describe('useLatestOnly', () => {
  it('keeps one Latest across renders, holding a ticket taken after StrictMode remounts', () => {
    const { result, rerender } = renderHook(() => useLatestOnly(), { wrapper: StrictMode });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first.take()()).toBe(true);
  });

  it('retires a ticket still out when the component unmounts', () => {
    const { result, unmount } = renderHook(() => useLatestOnly());
    const mine = result.current.take();
    unmount();
    expect(mine()).toBe(false);
  });
});
