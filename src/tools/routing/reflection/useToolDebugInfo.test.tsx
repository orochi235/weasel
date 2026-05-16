// src/tools/routing/reflection/useToolDebugInfo.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolDebugInfo } from './useToolDebugInfo';
import type { ToolsDispatcher } from '../../dispatcher';
import type { RouteResolvedInfo } from './route-resolved';
import { asNodeId } from '../../../core/scene/types';

function makeDispatcher(initial: RouteResolvedInfo | null = null): {
  dispatcher: ToolsDispatcher;
  setRoute: (r: RouteResolvedInfo) => void;
} {
  let last = initial;
  return {
    setRoute: (r) => { last = r; },
    dispatcher: {
      onPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {},
      onKeyDown: () => {}, onKeyUp: () => {}, onWheel: () => {},
      cancelGesture: () => {}, hasActiveGesture: () => false,
      getActiveScratch: () => null,
      getLastRoute: () => last,
      resolveOnly: () => null,
    },
  };
}

describe('useToolDebugInfo', () => {
  beforeEach(() => {
    let raf = 0;
    const handlers = new Map<number, FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      const id = ++raf;
      handlers.set(id, cb);
      // Macrotask scheduling (setTimeout) is REQUIRED here, not microtask:
      // the hook's rAF callback re-schedules itself every frame. A microtask
      // queue can't drain in that case because each tick enqueues another
      // microtask before yielding — vitest's own event loop is starved and
      // the runner hangs forever. setTimeout lets the loop drain between
      // ticks. The accompanying cancelAnimationFrame stub then breaks the
      // chain when the hook's useEffect cleanup runs at unmount.
      setTimeout(() => {
        const fn = handlers.get(id);
        if (fn) {
          handlers.delete(id);
          fn(performance.now());
        }
      }, 0);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      handlers.delete(id);
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns null when no route resolved', () => {
    const { dispatcher } = makeDispatcher();
    const { result } = renderHook(() => useToolDebugInfo(dispatcher));
    expect(result.current).toBeNull();
  });

  it('returns the most-recent route after the dispatcher updates', async () => {
    const { dispatcher, setRoute } = makeDispatcher();
    const { result } = renderHook(() => useToolDebugInfo(dispatcher));
    expect(result.current).toBeNull();
    const info: RouteResolvedInfo = {
      toolId: 'select', phase: 'initial', gesture: 'click',
      matchedKey: 'rect', modifiers: 'default',
      target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} },
      timestamp: 1000,
    };
    await act(async () => {
      setRoute(info);
      // Let one rAF tick fire. rAF is stubbed via setTimeout (macrotask)
      // so the wait here must also yield to macrotasks, not just microtasks.
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current).toEqual(info);
  });
});
