import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEdgeHover } from '../DiagramOverlaysDemo';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useEdgeHover', () => {
  it('clears an edge’s hover once the pointer has left it and its "+"', () => {
    const { result } = renderHook(() => useEdgeHover());
    act(() => result.current.onHover('ab'));
    act(() => result.current.onHover(null));
    expect(result.current.hovered).toBe('ab');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.hovered).toBeNull();
  });

  it('keeps it while the pointer is on the "+"', () => {
    const { result } = renderHook(() => useEdgeHover());
    act(() => result.current.onHover('ab'));
    act(() => result.current.onHover(null));
    act(() => result.current.stay());
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.hovered).toBe('ab');
    act(() => result.current.leave());
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.hovered).toBeNull();
  });
});
