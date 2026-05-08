import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePinchGesture } from './usePinchGesture';

function makeCanvas() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener: vi.fn((type: string, cb: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: EventListener) => {
      listeners.get(type)?.delete(cb);
    }),
    fire(type: string, event: Partial<PointerEvent>) {
      for (const cb of listeners.get(type) ?? []) cb(event as PointerEvent);
    },
  } as unknown as HTMLCanvasElement & { fire(type: string, e: Partial<PointerEvent>): void };
}

function makePointer(id: number, x: number, y: number): Partial<PointerEvent> {
  return { pointerId: id, clientX: x, clientY: y, type: 'pointermove' };
}

describe('usePinchGesture', () => {
  it('does not call onPinch with fewer than two pointers', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const onPinch = vi.fn();
    renderHook(() => usePinchGesture(canvasRef as any, onPinch));
    act(() => { canvas.fire('pointerdown', makePointer(1, 0, 0)); });
    act(() => { canvas.fire('pointermove', makePointer(1, 10, 10)); });
    expect(onPinch).not.toHaveBeenCalled();
  });

  it('calls onPinch with scaleFactor when two pointers are active', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const onPinch = vi.fn();
    renderHook(() => usePinchGesture(canvasRef as any, onPinch));
    // Two fingers at distance 100
    act(() => { canvas.fire('pointerdown', makePointer(1, 0, 0)); });
    act(() => { canvas.fire('pointerdown', makePointer(2, 100, 0)); });
    // Move second finger to 200 → distance doubles → scaleFactor = 2
    act(() => { canvas.fire('pointermove', makePointer(2, 200, 0)); });
    expect(onPinch).toHaveBeenCalled();
    const [anchor, factor] = onPinch.mock.calls[0];
    expect(factor).toBeCloseTo(2);        // 200/100
    expect(anchor.x).toBeCloseTo(100);    // midpoint of (0,0) and (200,0)
  });

  it('resets when a pointer lifts', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const onPinch = vi.fn();
    renderHook(() => usePinchGesture(canvasRef as any, onPinch));
    act(() => { canvas.fire('pointerdown', makePointer(1, 0, 0)); });
    act(() => { canvas.fire('pointerdown', makePointer(2, 100, 0)); });
    act(() => { canvas.fire('pointerup', { pointerId: 2 } as any); });
    onPinch.mockClear();
    act(() => { canvas.fire('pointermove', makePointer(1, 50, 0)); });
    expect(onPinch).not.toHaveBeenCalled();
  });

  it('removes listeners on unmount', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const { unmount } = renderHook(() => usePinchGesture(canvasRef as any, vi.fn()));
    unmount();
    expect(canvas.removeEventListener).toHaveBeenCalled();
  });
});
