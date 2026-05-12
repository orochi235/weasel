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
    },
  };
}

describe('useToolDebugInfo', () => {
  beforeEach(() => {
    let raf = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      raf++;
      // Synchronous schedule via microtask so act() can flush deterministically.
      queueMicrotask(() => cb(performance.now()));
      return raf;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
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
      // Let one rAF tick fire.
      await new Promise((r) => queueMicrotask(() => r(null)));
    });
    expect(result.current).toEqual(info);
  });
});
