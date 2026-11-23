import { describe, expect, it, vi } from 'vitest';
import type { Track } from '@weasel-js/animator';
import { act, renderHook } from '@testing-library/react';
import { useKeyAndSegment, useTimeWindow } from './timelineState';

describe('useTimeWindow', () => {
  it('pulls a zoomed window back inside a duration that shrinks under it', () => {
    const { result, rerender } = renderHook(({ duration }) => useTimeWindow(undefined, duration), { initialProps: { duration: 10000 } });
    act(() => result.current.setWindow({ from: 8000, to: 9000 }));
    rerender({ duration: 4000 });
    expect(result.current.win).toEqual({ from: 3000, to: 4000 });
    rerender({ duration: 500 });
    expect(result.current.win).toEqual({ from: 0, to: 500 });
  });
});

describe('useKeyAndSegment against tracks changed from outside', () => {
  const sampled = (label: string, ts: number[]): Track => ({ kind: 'sampled', label, keys: ts.map((t) => ({ t, value: t })) }) as Track;
  const start = [sampled('x', [0, 100, 200]), sampled('y', [0, 50])];

  it('drops a held key selection, reporting null, once a key is inserted before it from outside', () => {
    const onSelectionChange = vi.fn();
    const { result, rerender } = renderHook(({ tracks }) => useKeyAndSegment(undefined, tracks, onSelectionChange), { initialProps: { tracks: start } });
    act(() => result.current.selectKey({ trackPath: [0], keyIndex: 2 }));
    rerender({ tracks: [sampled('x', [0, 50, 100, 200]), start[1]] });
    expect(result.current.selection).toBeNull();
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });

  it('drops a held key selection once its track is replaced by another from outside', () => {
    const { result, rerender } = renderHook(({ tracks }) => useKeyAndSegment(undefined, tracks), { initialProps: { tracks: start } });
    act(() => result.current.selectKey({ trackPath: [1], keyIndex: 1 }));
    rerender({ tracks: [start[1]] });
    rerender({ tracks: [start[0], sampled('z', [0, 50])] });
    expect(result.current.selection).toBeNull();
  });

  it('takes a key selection given again after it went null and its track was edited from outside', () => {
    const onSelectionChange = vi.fn();
    const sel = { trackPath: [0], keyIndex: 1 };
    const { result, rerender } = renderHook(
      ({ given, tracks }) => useKeyAndSegment(given, tracks, onSelectionChange),
      { initialProps: { given: sel as typeof sel | null, tracks: start } },
    );
    rerender({ given: null, tracks: start });
    const edited = [sampled('x', [0, 50, 100, 200]), start[1]];
    rerender({ given: null, tracks: edited });
    rerender({ given: sel, tracks: edited });
    expect(result.current.selection).toEqual(sel);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('keeps it across the timeline\'s own edits and a copy of the same tracks', () => {
    const { result, rerender } = renderHook(({ tracks }) => useKeyAndSegment(undefined, tracks), { initialProps: { tracks: start } });
    act(() => result.current.selectKey({ trackPath: [0], keyIndex: 2 }));
    const edited = [sampled('x', [0, 100, 300]), start[1]];
    act(() => result.current.send(edited));
    rerender({ tracks: edited });
    rerender({ tracks: edited.slice() });
    expect(result.current.selection).toEqual({ trackPath: [0], keyIndex: 2 });
  });

  it('drops a segment selection by the same rule, and keeps it across the timeline\'s own edits', () => {
    const { result, rerender } = renderHook(({ tracks }) => useKeyAndSegment(undefined, tracks), { initialProps: { tracks: start } });
    act(() => result.current.selectSegment({ trackPath: [1], keyIndex: 1 }));
    const own = [start[0], { ...start[1] } as Track];
    act(() => result.current.send(own));
    rerender({ tracks: own });
    expect(result.current.segmentSelection).toEqual({ trackPath: [1], keyIndex: 1 });
    rerender({ tracks: [start[1], start[0]] });
    expect(result.current.segmentSelection).toBeNull();
  });
});
