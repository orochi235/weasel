import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTimeWindow } from './timelineState';

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
