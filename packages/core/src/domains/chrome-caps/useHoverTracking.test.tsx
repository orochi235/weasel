import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEffect } from 'react';
import { useHoverTracking } from './useHoverTracking';
import { asNodeId } from '../../core/scene/types';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';

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
  onChange?: (id: ReturnType<typeof asNodeId> | null) => void;
}) {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const { result } = renderHook(() => {
    const toWorld = opts.clientToWorld ?? ((cx: number, cy: number) => ({ x: cx, y: cy }));
    return useHoverTracking({
      nodeAtClientPoint: (cx, cy) => {
        const w = toWorld(cx, cy);
        return opts.getNodeAtPoint(w.x, w.y);
      },
      ...(opts.onChange ? { onChange: opts.onChange } : {}),
    });
  });
  // After the hook's own effects have run: an element that arrives late must
  // still be tracked.
  act(() => { result.current.canvasRef(canvas); });
  return { canvas, getHover: result.current.getHover, cleanup: () => canvas.remove() };
}

describe('useHoverTracking', () => {
  it('reports each change of hovered id once, and null on leave', () => {
    const seen: (string | null)[] = [];
    const { canvas, cleanup } = renderHoverHook({
      getNodeAtPoint: (x) => (x < 10 ? null : { id: asNodeId(x < 20 ? 'a' : 'b') }),
      onChange: (id) => seen.push(id),
    });
    act(() => {
      fireMove(canvas, 12, 0);
      fireMove(canvas, 14, 0);
      fireMove(canvas, 25, 0);
      fireMove(canvas, 5, 0);
      fireMove(canvas, 12, 0);
      fireLeave(canvas);
    });
    expect(seen).toEqual(['a', 'b', null, 'a', null]);
    cleanup();
  });

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

describe('useHoverTracking — the getter', () => {
  it('is the same function on every render', () => {
    const { result, rerender } = renderHook(() =>
      useHoverTracking({ nodeAtClientPoint: () => null }));
    const first = result.current;
    rerender();
    expect(result.current.getHover).toBe(first.getHover);
    expect(result.current.canvasRef).toBe(first.canvasRef);
  });

  it('forgets the hovered node when tracking is turned off', () => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useHoverTracking({
        nodeAtClientPoint: () => ({ id: asNodeId('a') }), enabled,
      }),
      { initialProps: { enabled: true } },
    );
    act(() => { result.current.canvasRef(canvas); });
    act(() => { fireMove(canvas, 1, 1); });
    expect(result.current.getHover()).toBe(asNodeId('a'));
    rerender({ enabled: false });
    expect(result.current.getHover()).toBeNull();
    act(() => { fireMove(canvas, 1, 1); });
    expect(result.current.getHover()).toBeNull();
    rerender({ enabled: true });
    act(() => { fireMove(canvas, 1, 1); });
    expect(result.current.getHover()).toBe(asNodeId('a'));
    canvas.remove();
  });

  it('stops tracking an element it is handed null for', () => {
    const canvas = document.createElement('canvas');
    const { result } = renderHook(() =>
      useHoverTracking({ nodeAtClientPoint: () => ({ id: asNodeId('a') }) }));
    act(() => { result.current.canvasRef(canvas); });
    act(() => { fireMove(canvas, 1, 1); });
    act(() => { result.current.canvasRef(null); });
    expect(result.current.getHover()).toBeNull();
    act(() => { fireMove(canvas, 1, 1); });
    expect(result.current.getHover()).toBeNull();
  });
});

describe('useHoverTracking — abandoned renders', () => {
  it('hit-tests with the committed picker, not an abandoned render\'s', () => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const pickers = {
      a: () => ({ id: asNodeId('a') }),
      b: () => ({ id: asNodeId('b') }),
    };
    let getHover: (() => unknown) | null = null;
    function Probe({ which }: { which: 'a' | 'b' }) {
      const hover = useHoverTracking({ nodeAtClientPoint: pickers[which] });
      useEffect(() => { hover.canvasRef(canvas); }, [hover]);
      if (which === 'a') getHover = hover.getHover;
      return null;
    }
    renderThenAbandon<'a' | 'b'>('a', 'b', (which) => <Probe which={which} />);
    act(() => { fireMove(canvas, 1, 1); });
    expect(getHover!()).toBe(asNodeId('a'));
    canvas.remove();
  });
});
