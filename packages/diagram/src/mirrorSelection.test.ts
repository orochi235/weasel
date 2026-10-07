import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMirroredSelection } from './mirrorSelection';

const api = (current: string[]) => ({ get: () => current as never[], set: vi.fn() });

describe('useMirroredSelection', () => {
  it('pushes the prop into the canvas selection', () => {
    const sel = api([]);
    renderHook(() => useMirroredSelection(sel, 'a', undefined));
    expect(sel.set).toHaveBeenCalledWith(['a']);
  });

  it('reports what a click left selected', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useMirroredSelection(api(['b']), null, onSelect));
    result.current();
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('reports a re-click on the node already selected', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useMirroredSelection(api(['a']), 'a', onSelect));
    result.current();
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('reports null for a click that cleared the selection', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useMirroredSelection(api([]), 'a', onSelect));
    result.current();
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('does not report on mount, so a controlled prop is never cleared', () => {
    const onSelect = vi.fn();
    renderHook(() => useMirroredSelection(api([]), 'a', onSelect));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not push when the two agree', () => {
    const sel = api(['a']);
    renderHook(() => useMirroredSelection(sel, 'a', undefined));
    expect(sel.set).not.toHaveBeenCalled();
  });
});
