import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { Suspense, createElement, startTransition, useState } from 'react';
import { Hang } from '@weasel-js/react/testing/abandonRender';
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

describe('useGuides — abandoned renders', () => {
  it('getGuides and subscribers hold a write a suspended transition has not yet rendered', () => {
    let api: ReturnType<typeof useGuides> | null = null;
    let hang: (h: boolean) => void = () => {};
    function Host(): ReturnType<typeof createElement> {
      const [on, setOn] = useState(false);
      hang = setOn;
      api = useGuides();
      return createElement(Suspense, { fallback: null }, createElement(Hang, { hang: on }));
    }
    render(createElement(Host));
    const committed = api!;
    let heard = 0;
    committed.subscribe(() => { heard++; });
    act(() => {
      startTransition(() => {
        committed.addGuide({ id: 'g', axis: 'x', offset: 5 });
        hang(true);
      });
    });
    expect(committed.getGuides()).toEqual([{ id: 'g', axis: 'x', offset: 5 }]);
    expect(heard).toBe(1);
  });

  it('getGuides reads each write at once, so an op in a batch sees the one before it', () => {
    const { result } = renderHook(() => useGuides());
    let seen: unknown;
    act(() => {
      result.current.addGuide({ id: 'a', axis: 'x', offset: 1 });
      seen = result.current.getGuides();
    });
    expect(seen).toEqual([{ id: 'a', axis: 'x', offset: 1 }]);
  });

  it('tells subscribers of each change once getGuides returns it, and not of the initial list', () => {
    const { result } = renderHook(() => useGuides([{ id: 'a', axis: 'x', offset: 1 }]));
    const seen: number[] = [];
    result.current.subscribe(() => seen.push(result.current.getGuides().length));
    act(() => result.current.addGuide({ id: 'b', axis: 'y', offset: 2 }));
    act(() => result.current.removeGuide('a'));
    act(() => result.current.removeGuide('missing'));
    expect(seen).toEqual([2, 1]);
  });
});
