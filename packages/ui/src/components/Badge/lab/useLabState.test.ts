import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { useLabState, type LabArgs } from './useLabState';

const ARGS: LabArgs = { look: 'info', variant: 'solid', label: 'Badge' };

const undo = () => act(() => { fireEvent.keyDown(window, { key: 'z', metaKey: true }); });
const redo = () => act(() => { fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true }); });
const settle = () => act(() => { vi.advanceTimersByTime(300); });

describe('useLabState undo', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('collapses a run of changes into one step once the lab is still', () => {
    const { result } = renderHook(() => useLabState(ARGS));
    for (let x = 1; x <= 5; x++) {
      act(() => result.current[1]({ labelX: x }));
      act(() => { vi.advanceTimersByTime(100); });
    }
    settle();
    act(() => result.current[1]({ labelX: 9 }));
    settle();

    undo();
    expect(result.current[0].labelX).toBe(5);
    undo();
    expect(result.current[0].labelX).toBe(0);
    undo();
    expect(result.current[0].labelX).toBe(0);
    redo();
    expect(result.current[0].labelX).toBe(5);
    redo();
    expect(result.current[0].labelX).toBe(9);
  });

  it('records a change still settling before it undoes', () => {
    const { result } = renderHook(() => useLabState(ARGS));
    act(() => result.current[1]({ bold: true }));
    settle();
    act(() => result.current[1]({ labelY: 3 }));
    undo();
    expect(result.current[0]).toMatchObject({ bold: true, labelY: 0 });
    redo();
    expect(result.current[0].labelY).toBe(3);
  });

  it('drops the redo future on a new edit', () => {
    const { result } = renderHook(() => useLabState(ARGS));
    act(() => result.current[1]({ zoom: 3 }));
    settle();
    undo();
    act(() => result.current[1]({ zoom: 4 }));
    settle();
    redo();
    expect(result.current[0].zoom).toBe(4);
    undo();
    expect(result.current[0].zoom).toBe(2);
  });
});
