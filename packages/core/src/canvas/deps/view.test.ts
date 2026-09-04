import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewDepSource, type DecayApi } from './view';
import type { View } from 'core/viewport/view';

const V: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function makeDecay() {
  return { start: vi.fn(), cancel: vi.fn() } satisfies DecayApi;
}

describe('useViewDepSource — decay', () => {
  it('omits decay and stopDecay when no loop is passed', () => {
    const ref = { current: V };
    const { result } = renderHook(() => useViewDepSource(ref, () => {}));
    expect(result.current.decay).toBeUndefined();
    expect(result.current.stopDecay).toBeUndefined();
  });

  it('publishes decay and stopDecay that forward to the loop', () => {
    const ref = { current: V };
    const decay = makeDecay();
    const { result } = renderHook(() =>
      useViewDepSource(ref, () => {}, undefined, undefined, undefined, decay));
    const config = { velocity: { vx: 1, vy: 2 }, onTick: () => {} };
    result.current.decay!(config);
    expect(decay.start).toHaveBeenCalledWith(config);
    result.current.stopDecay!();
    expect(decay.cancel).toHaveBeenCalled();
  });

  it('rebuilds the api when decay appears, so the member stops reading falsy', () => {
    // The `shape` guard: an unwired optional member must be absent, and a
    // memoized object that never rebuilds would keep it absent forever.
    const ref = { current: V };
    const decay = makeDecay();
    const { result, rerender } = renderHook(
      ({ d }: { d?: DecayApi }) =>
        useViewDepSource(ref, () => {}, undefined, undefined, undefined, d),
      { initialProps: {} as { d?: DecayApi } },
    );
    expect(result.current.decay).toBeUndefined();
    rerender({ d: decay });
    expect(result.current.decay).toBeTypeOf('function');
    rerender({ d: undefined });
    expect(result.current.decay).toBeUndefined();
  });

  it('keeps a stable identity across rerenders that do not change the shape', () => {
    const ref = { current: V };
    const decay = makeDecay();
    const { result, rerender } = renderHook(() =>
      useViewDepSource(ref, () => {}, undefined, undefined, undefined, decay));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('forwards to the latest loop without changing api identity', () => {
    const ref = { current: V };
    const first = makeDecay();
    const second = makeDecay();
    const { result, rerender } = renderHook(
      ({ d }: { d: DecayApi }) =>
        useViewDepSource(ref, () => {}, undefined, undefined, undefined, d),
      { initialProps: { d: first } },
    );
    const api = result.current;
    rerender({ d: second });
    expect(result.current).toBe(api);
    result.current.decay!({ velocity: { vx: 0, vy: 0 }, onTick: () => {} });
    expect(first.start).not.toHaveBeenCalled();
    expect(second.start).toHaveBeenCalled();
  });
});
