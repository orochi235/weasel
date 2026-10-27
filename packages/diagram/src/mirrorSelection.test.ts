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
    expect(onSelect).toHaveBeenCalledWith('b', ['b']);
  });

  it('reports a re-click on the node already selected', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useMirroredSelection(api(['a']), 'a', onSelect));
    result.current();
    expect(onSelect).toHaveBeenCalledWith('a', ['a']);
  });

  it('reports null for a click that cleared the selection', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useMirroredSelection(api([]), 'a', onSelect));
    result.current();
    expect(onSelect).toHaveBeenCalledWith(null, []);
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

  it('reports the latest pick and every id picked', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useMirroredSelection(api(['a', 'b']), null, onSelect));
    result.current();
    expect(onSelect).toHaveBeenCalledWith('b', ['a', 'b']);
  });

  it('leaves a pick of several alone when handed its latest id, and pushes one it is not', () => {
    const sel = api(['a', 'b']);
    const { rerender } = renderHook(({ id }) => useMirroredSelection(sel, id, undefined), { initialProps: { id: 'b' } });
    expect(sel.set).not.toHaveBeenCalled();
    rerender({ id: 'a' });
    expect(sel.set).toHaveBeenCalledWith(['a']);
  });

  it('pushes a set, and not one the selection holds in another order', () => {
    const sel = api(['b', 'a']);
    const { rerender } = renderHook(({ ids }) => useMirroredSelection(sel, ids, undefined), { initialProps: { ids: ['a', 'b'] as readonly string[] } });
    expect(sel.set).not.toHaveBeenCalled();
    rerender({ ids: ['a', 'c'] });
    expect(sel.set).toHaveBeenCalledWith(['a', 'c']);
  });
});
