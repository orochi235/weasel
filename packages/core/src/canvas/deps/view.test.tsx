import { describe, it, expect, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useViewDepSource } from './view';
import type { ViewAnimationApi } from 'core/viewport/useViewAnimation';
import type { View } from 'core/viewport/view';

describe('useViewDepSource', () => {
  it('returns a stable-identity ViewApi that reads/writes through the supplied ref + callback', () => {
    let capturedView: any = null;
    const onChange = vi.fn();
    const v1: View = { x: 0, y: 0, scale: 1 } as unknown as View;
    function Wire() {
      const viewRef = useRef<View>(v1);
      const api = useViewDepSource(viewRef, onChange);
      capturedView = api;
      return null;
    }
    render(<Wire />);
    expect(capturedView).toBeDefined();
    expect(capturedView.get()).toBe(v1);
    const v2: View = { x: 5, y: 5, scale: 2 } as unknown as View;
    capturedView.set(v2);
    expect(onChange).toHaveBeenCalledWith(v2);
  });
});

// ---------------------------------------------------------------------------
// Camera animation members
// ---------------------------------------------------------------------------

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function fakeRunner(): ViewAnimationApi {
  return {
    animate: vi.fn(),
    animateToBounds: vi.fn(),
    stop: vi.fn(),
    isAnimating: vi.fn(() => false),
    target: vi.fn(() => null),
    stopIfExternal: vi.fn(),
  };
}

describe('useViewDepSource with a camera runner', () => {
  it('omits the animation members when no runner is wired', () => {
    const ref = { current: HOME };
    const { result } = renderHook(() => useViewDepSource(ref, vi.fn()));
    expect(result.current.animate).toBeUndefined();
    expect(result.current.stopAnimation).toBeUndefined();
    expect(result.current.animationTarget).toBeUndefined();
  });

  it('cancels an in-flight animation on any set', () => {
    const ref = { current: HOME };
    const runner = fakeRunner();
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useViewDepSource(ref, onViewChange, undefined, undefined, runner),
    );

    result.current.set({ x: 5, y: 5, scale: { x: 1, y: 1 } });

    expect(runner.stopIfExternal).toHaveBeenCalledOnce();
    expect(onViewChange).toHaveBeenCalledWith({ x: 5, y: 5, scale: { x: 1, y: 1 } });
  });

  it('forwards animate, stopAnimation and animationTarget to the runner', () => {
    const ref = { current: HOME };
    const runner = fakeRunner();
    (runner.target as ReturnType<typeof vi.fn>).mockReturnValue({ x: 1, y: 2, scale: { x: 3, y: 3 } });
    const { result } = renderHook(() =>
      useViewDepSource(ref, vi.fn(), undefined, undefined, runner),
    );

    result.current.animate!({ x: 9, y: 9, scale: { x: 2, y: 2 } }, { ms: 400 });
    expect(runner.animate).toHaveBeenCalledWith({ x: 9, y: 9, scale: { x: 2, y: 2 } }, { ms: 400 });

    result.current.stopAnimation!();
    expect(runner.stop).toHaveBeenCalledOnce();

    expect(result.current.animationTarget!()).toEqual({ x: 1, y: 2, scale: { x: 3, y: 3 } });
  });

  it('keeps one stable ViewApi identity across renders', () => {
    const ref = { current: HOME };
    const runner = fakeRunner();
    const { result, rerender } = renderHook(() =>
      useViewDepSource(ref, vi.fn(), undefined, undefined, runner),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
