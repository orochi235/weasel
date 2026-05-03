import { describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { renderHook } from '@testing-library/react';
import { useLayerEffect } from './useLayerEffect';

function makeCanvas() {
  const canvas = document.createElement('canvas');
  const calls: { fn: string; args: unknown[] }[] = [];
  const ctx = {
    setTransform: vi.fn((...args: unknown[]) => { calls.push({ fn: 'setTransform', args }); }),
    clearRect: vi.fn((...args: unknown[]) => { calls.push({ fn: 'clearRect', args }); }),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as RenderingContext);
  return { canvas, ctx, calls };
}

describe('useLayerEffect', () => {
  it('does nothing when ref has no canvas', () => {
    const renderFn = vi.fn();
    renderHook(() => {
      const ref = useRef<HTMLCanvasElement>(null);
      useLayerEffect(ref, 100, 100, true, renderFn, [], 1);
    });
    expect(renderFn).not.toHaveBeenCalled();
  });

  it('does nothing when width is 0', () => {
    const { canvas } = makeCanvas();
    const renderFn = vi.fn();
    renderHook(() => {
      const ref = useRef<HTMLCanvasElement>(canvas);
      useLayerEffect(ref, 0, 100, true, renderFn, [], 1);
    });
    expect(renderFn).not.toHaveBeenCalled();
  });

  it('sizes canvas to width*dpr x height*dpr and applies the dpr transform', () => {
    const { canvas, calls } = makeCanvas();
    const renderFn = vi.fn();
    renderHook(() => {
      const ref = useRef<HTMLCanvasElement>(canvas);
      useLayerEffect(ref, 200, 100, true, renderFn, [], 2);
    });
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(200);
    expect(calls.find((c) => c.fn === 'setTransform')?.args).toEqual([2, 0, 0, 2, 0, 0]);
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('defaults dpr to window.devicePixelRatio when omitted', () => {
    const original = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    try {
      const { canvas } = makeCanvas();
      renderHook(() => {
        const ref = useRef<HTMLCanvasElement>(canvas);
        useLayerEffect(ref, 100, 50, true, vi.fn(), []);
      });
      expect(canvas.width).toBe(300);
      expect(canvas.height).toBe(150);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: original, configurable: true });
    }
  });

  it('clears the canvas and skips renderFn when not visible', () => {
    const { canvas, calls } = makeCanvas();
    const renderFn = vi.fn();
    renderHook(() => {
      const ref = useRef<HTMLCanvasElement>(canvas);
      useLayerEffect(ref, 200, 100, false, renderFn, [], 1);
    });
    expect(renderFn).not.toHaveBeenCalled();
    expect(calls.find((c) => c.fn === 'clearRect')?.args).toEqual([0, 0, 200, 100]);
  });

  it('re-runs effect when deps change', () => {
    const { canvas } = makeCanvas();
    const renderFn = vi.fn();
    const { rerender } = renderHook(
      ({ dep }: { dep: number }) => {
        const ref = useRef<HTMLCanvasElement>(canvas);
        useLayerEffect(ref, 100, 100, true, renderFn, [dep], 1);
      },
      { initialProps: { dep: 1 } },
    );
    expect(renderFn).toHaveBeenCalledTimes(1);
    rerender({ dep: 2 });
    expect(renderFn).toHaveBeenCalledTimes(2);
    rerender({ dep: 2 });
    expect(renderFn).toHaveBeenCalledTimes(2);
  });
});
