import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGuides } from './useGuides';

describe('useGuides', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useGuides());
    expect(result.current.guides).toEqual([]);
    expect(result.current.getGuides()).toEqual([]);
  });

  it('starts with the supplied initial list', () => {
    const { result } = renderHook(() =>
      useGuides([{ id: 'a', axis: 'x', offset: 50 }]),
    );
    expect(result.current.guides).toEqual([{ id: 'a', axis: 'x', offset: 50 }]);
  });

  it('addGuide appends and getGuides reflects the latest list', () => {
    const { result } = renderHook(() => useGuides());
    act(() => {
      result.current.addGuide({ id: 'a', axis: 'x', offset: 10 });
      result.current.addGuide({ id: 'b', axis: 'y', offset: 20 });
    });
    expect(result.current.guides).toEqual([
      { id: 'a', axis: 'x', offset: 10 },
      { id: 'b', axis: 'y', offset: 20 },
    ]);
    expect(result.current.getGuides()).toEqual(result.current.guides);
  });

  it('addGuide replaces an existing entry with the same id', () => {
    const { result } = renderHook(() => useGuides());
    act(() => {
      result.current.addGuide({ id: 'a', axis: 'x', offset: 10 });
      result.current.addGuide({ id: 'a', axis: 'y', offset: 99 });
    });
    expect(result.current.guides).toEqual([{ id: 'a', axis: 'y', offset: 99 }]);
  });

  it('removeGuide drops a single entry', () => {
    const { result } = renderHook(() => useGuides());
    act(() => {
      result.current.addGuide({ id: 'a', axis: 'x', offset: 10 });
      result.current.addGuide({ id: 'b', axis: 'y', offset: 20 });
      result.current.removeGuide('a');
    });
    expect(result.current.guides).toEqual([{ id: 'b', axis: 'y', offset: 20 }]);
  });

  it('removeGuide is a no-op for unknown ids', () => {
    const { result } = renderHook(() => useGuides());
    act(() => {
      result.current.addGuide({ id: 'a', axis: 'x', offset: 10 });
    });
    const before = result.current.guides;
    act(() => {
      result.current.removeGuide('zzz');
    });
    expect(result.current.guides).toBe(before);
  });

  it('clearGuides empties the list', () => {
    const { result } = renderHook(() => useGuides());
    act(() => {
      result.current.addGuide({ id: 'a', axis: 'x', offset: 10 });
      result.current.addGuide({ id: 'b', axis: 'y', offset: 20 });
      result.current.clearGuides();
    });
    expect(result.current.guides).toEqual([]);
  });

  it('getGuides is referentially stable across renders', () => {
    const { result, rerender } = renderHook(() => useGuides());
    const before = result.current.getGuides;
    act(() => {
      result.current.addGuide({ id: 'a', axis: 'x', offset: 10 });
    });
    rerender();
    expect(result.current.getGuides).toBe(before);
  });
});
