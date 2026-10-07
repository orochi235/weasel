import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMirroredSelection } from './mirrorSelection';

const api = (current: string[]) => ({ current: current as never[], set: vi.fn() });

describe('useMirroredSelection', () => {
  it('pushes the prop into the canvas selection', () => {
    const sel = api([]);
    renderHook(() => useMirroredSelection(sel, 'a', undefined));
    expect(sel.set).toHaveBeenCalledWith(['a']);
  });

  it('reports a canvas pick through onSelect', () => {
    const onSelect = vi.fn();
    let current: string[] = [];
    const { rerender } = renderHook(() => useMirroredSelection(api(current), null, onSelect));
    current = ['b'];
    rerender();
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('does not report on mount, so a controlled prop is never cleared', () => {
    const onSelect = vi.fn();
    renderHook(() => useMirroredSelection(api([]), 'a', onSelect));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not report the echo of its own push', () => {
    const onSelect = vi.fn();
    let current: string[] = [];
    const { rerender } = renderHook(() => useMirroredSelection(api(current), 'a', onSelect));
    current = ['a'];
    rerender();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does nothing when the two agree', () => {
    const sel = api(['a']);
    const onSelect = vi.fn();
    renderHook(() => useMirroredSelection(sel, 'a', onSelect));
    expect(sel.set).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
