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

/** Two fingers down on the x axis, `span` apart. */
function pinchStart(canvas: ReturnType<typeof makeCanvas>, span: number) {
  act(() => { canvas.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 } as never); });
  act(() => { canvas.fire('pointerdown', { pointerId: 2, clientX: span, clientY: 0 } as never); });
}

/** Move the second finger so the fingers are now `span` apart. */
function pinchTo(canvas: ReturnType<typeof makeCanvas>, span: number) {
  act(() => { canvas.fire('pointermove', { pointerId: 2, clientX: span, clientY: 0 } as never); });
}

describe('usePinchZoomTool', () => {
  it('calls setView with zoomed view on pinch', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const setView = vi.fn();
    const view: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

    renderHook(() => usePinchZoomTool(canvasRef, () => view, setView));

    // Two fingers: start at distance 100
    pinchStart(canvas, 100);
    // Move second finger to 200 → distance doubles → scale doubles
    pinchTo(canvas, 200);

    expect(setView).toHaveBeenCalled();
    const newView = setView.mock.calls[0][0] as View;
    expect(newView.scale.x).toBeCloseTo(2);
    expect(newView.scale.y).toBeCloseTo(2);
  });

  it('compounds successive pinch moves with no render between them', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    let live: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const setView = vi.fn((v: View) => { live = v; });

    // Rendered once. `usePinchGesture` reports a per-frame delta, so a base
    // captured at render time makes every move restart from scale 1.
    renderHook(() => usePinchZoomTool(canvasRef, () => live, setView, { max: 100 }));

    pinchStart(canvas, 100);
    pinchTo(canvas, 200);
    pinchTo(canvas, 400);
    pinchTo(canvas, 800);

    const scales = (setView.mock.calls as [View][]).map((c) => Number(c[0].scale.x.toFixed(4)));
    expect(scales).toEqual([2, 4, 8]);
    expect(live.scale.x).toBeCloseTo(8);
  });

  it('zooms from a view changed after mount, without a re-render', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    let live: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const setView = vi.fn((v: View) => { live = v; });

    renderHook(() => usePinchZoomTool(canvasRef, () => live, setView, { max: 100 }));

    live = { x: 0, y: 0, scale: { x: 4, y: 4 } };
    pinchStart(canvas, 100);
    pinchTo(canvas, 200);

    expect((setView.mock.calls[0][0] as View).scale.x).toBeCloseTo(8);
  });
});
