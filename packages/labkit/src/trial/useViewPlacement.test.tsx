import { renderHook } from '@testing-library/react';
import { act, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fitStage } from '../canvas/Stage';
import type { Instrument } from '../instrument/types';
import { useViewPlacement } from './useViewPlacement';

const SIZE = { width: 400, height: 300 };
const staged: Instrument = {
  name: 'Staged',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
  stage: { size: SIZE },
};

const WIDE = { width: 800, height: 600 };
const NARROW = { width: 200, height: 600 };

function place(initial: unknown = null, instrument: Instrument = staged) {
  return renderHook(() => {
    const [view, setView] = useState<unknown>(initial);
    const onResize = useViewPlacement({
      instrument,
      view,
      setView,
      presented: false,
      viewport: { current: null },
    });
    return { view, setView, onResize };
  });
}

describe('a view placed by its viewport size', () => {
  it('is placed on the first measurement', () => {
    const { result } = place();
    act(() => result.current.onResize(WIDE));
    expect(result.current.view).toEqual(fitStage(SIZE, WIDE));
  });

  it('is placed again when the viewport changes size, while nobody has moved it', () => {
    const { result } = place();
    act(() => result.current.onResize(WIDE));
    act(() => result.current.onResize(NARROW));
    expect(result.current.view).toEqual(fitStage(SIZE, NARROW));
    act(() => result.current.onResize(WIDE));
    expect(result.current.view).toEqual(fitStage(SIZE, WIDE));
  });

  it('keeps a view someone moved', () => {
    const { result } = place();
    act(() => result.current.onResize(WIDE));
    const moved = { zoom: 2, pan: { x: 5, y: 6 } };
    act(() => result.current.setView(moved));
    act(() => result.current.onResize(NARROW));
    expect(result.current.view).toBe(moved);
  });

  it('follows a stored view that sits where the first measurement would place it', () => {
    const { result } = place(fitStage(SIZE, WIDE));
    act(() => result.current.onResize(WIDE));
    act(() => result.current.onResize(NARROW));
    expect(result.current.view).toEqual(fitStage(SIZE, NARROW));
  });

  it('keeps a stored view that sits anywhere else', () => {
    const stored = { zoom: 1, pan: { x: 0, y: 0 } };
    const { result } = place(stored);
    act(() => result.current.onResize(WIDE));
    act(() => result.current.onResize(NARROW));
    expect(result.current.view).toBe(stored);
  });

  it('leaves a view alone when where it opens does not depend on the size', () => {
    const fixed: Instrument = {
      ...staged,
      stage: { size: SIZE, initialView: { zoom: 1, pan: { x: 9, y: 9 } } },
    };
    const { result } = place(null, fixed);
    act(() => result.current.onResize(WIDE));
    act(() => result.current.onResize(NARROW));
    expect(result.current.view).toBeNull();
  });
});
