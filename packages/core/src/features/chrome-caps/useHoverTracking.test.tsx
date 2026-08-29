import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, useEffect } from 'react';
import { useHoverTracking } from './useHoverTracking';
import { asNodeId } from '../../core/scene/types';

function fireMove(el: Element, clientX: number, clientY: number): void {
  const ev = new Event('pointermove', { bubbles: true }) as PointerEvent;
  Object.defineProperties(ev, {
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  el.dispatchEvent(ev);
}

function fireLeave(el: Element): void {
  el.dispatchEvent(new Event('pointerleave', { bubbles: true }));
}

function renderHoverHook(opts: {
  getNodeAtPoint: (x: number, y: number) => { id: ReturnType<typeof asNodeId> } | null;
  clientToWorld?: (cx: number, cy: number) => { x: number; y: number };
}) {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const { result } = renderHook(() => {
    const ref = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => { ref.current = canvas; }, []);
    ref.current = canvas;
    const toWorld = opts.clientToWorld ?? ((cx: number, cy: number) => ({ x: cx, y: cy }));
    return useHoverTracking({
      canvasRef: ref,
      nodeAtClientPoint: (cx, cy) => {
        const w = toWorld(cx, cy);
        return opts.getNodeAtPoint(w.x, w.y);
      },
    });
  });
  return { canvas, getHover: result.current, cleanup: () => canvas.remove() };
}

describe('useHoverTracking', () => {
  it('returns null before any pointer event', () => {
    const { getHover, cleanup } = renderHoverHook({ getNodeAtPoint: () => null });
    expect(getHover()).toBeNull();
    cleanup();
  });

  it('caches the topmost-id from getNodeAtPoint on pointermove', () => {
    const { canvas, getHover, cleanup } = renderHoverHook({
      getNodeAtPoint: (x) => (x > 0 ? { id: asNodeId('node-a') } : null),
    });
    act(() => { fireMove(canvas, 10, 10); });
    expect(getHover()).toBe(asNodeId('node-a'));
    cleanup();
  });

  it('clears the cache on pointerleave', () => {
    const { canvas, getHover, cleanup } = renderHoverHook({
      getNodeAtPoint: () => ({ id: asNodeId('node-a') }),
    });
    act(() => { fireMove(canvas, 10, 10); });
    expect(getHover()).toBe(asNodeId('node-a'));
    act(() => { fireLeave(canvas); });
    expect(getHover()).toBeNull();
    cleanup();
  });

  it('reports null when getNodeAtPoint returns null (pointer over empty canvas)', () => {
    const { canvas, getHover, cleanup } = renderHoverHook({ getNodeAtPoint: () => null });
    act(() => { fireMove(canvas, 5, 5); });
    expect(getHover()).toBeNull();
    cleanup();
  });

  it('passes world coords (not client coords) to getNodeAtPoint', () => {
    const seen: Array<{ x: number; y: number }> = [];
    const { canvas, cleanup } = renderHoverHook({
      getNodeAtPoint: (x, y) => { seen.push({ x, y }); return null; },
      clientToWorld: (cx, cy) => ({ x: cx * 2, y: cy * 2 }),
    });
    act(() => { fireMove(canvas, 10, 20); });
    expect(seen).toEqual([{ x: 20, y: 40 }]);
    cleanup();
  });
});
