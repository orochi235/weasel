import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePinchZoomTool } from './usePinchZoomTool';
import type { View } from 'core/viewport/view';

function makeCanvas() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener: vi.fn((t: string, cb: EventListener) => {
      if (!listeners.has(t)) listeners.set(t, new Set());
      listeners.get(t)!.add(cb);
    }),
    removeEventListener: vi.fn(),
    getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 800, height: 600 }),
    fire(type: string, e: Partial<PointerEvent>) {
      for (const cb of listeners.get(type) ?? []) cb(e as PointerEvent);
    },
  } as unknown as HTMLCanvasElement & { fire(t: string, e: Partial<PointerEvent>): void };
}

describe('usePinchZoomTool', () => {
  it('calls setView with zoomed view on pinch', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const setView = vi.fn();
    const view: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

    renderHook(() => usePinchZoomTool(canvasRef as any, view, setView));

    // Two fingers: start at distance 100
    act(() => { canvas.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 } as any); });
    act(() => { canvas.fire('pointerdown', { pointerId: 2, clientX: 100, clientY: 0 } as any); });
    // Move second finger to 200 → distance doubles → scale doubles
    act(() => { canvas.fire('pointermove', { pointerId: 2, clientX: 200, clientY: 0 } as any); });

    expect(setView).toHaveBeenCalled();
    const newView = setView.mock.calls[0][0] as View;
    expect(newView.scale.x).toBeCloseTo(2);
    expect(newView.scale.y).toBeCloseTo(2);
  });
});
