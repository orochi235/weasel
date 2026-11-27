import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Dispatcher } from '@weasel-js/routing';
import type { View } from 'core/viewport/view';
import { useEdgePan } from './useEdgePan';

beforeEach(() => { vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] }); });
afterEach(() => { vi.useRealTimers(); });

describe('useEdgePan', () => {
  it('holds the view inside its limit by the canvas\'s layout size under a CSS scale', async () => {
    // A 400 × 200 canvas drawn at half size by an ancestor's transform.
    const el = document.createElement('div');
    document.body.appendChild(el);
    el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) });
    let moves = 0;
    let view: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    let pump = () => {};
    const dispatcher = {
      inFlight: () => new Map([['h', { autoPan: true }]]),
      subscribe: (fn: () => void) => { pump = fn; return () => {}; },
    } as unknown as Dispatcher;
    const { result } = renderHook(() => useEdgePan({
      options: { limit: { x: 0, y: 0, width: 400, height: 200 } },
      dispatcher, element: () => el, layoutSize: () => ({ width: 400, height: 200 }),
      getView: () => view, setView: (next) => { moves++; view = next; }, content: () => null,
    }));
    act(() => {
      result.current.heldPointer({ at: () => ({ clientX: 199, clientY: 50 }), repeat: () => {} });
      pump();
    });
    for (let i = 0; i < 10; i++) await act(async () => { await vi.advanceTimersByTimeAsync(16); });
    expect(moves).toBeGreaterThan(0);
    expect(view.x).toBe(0);
    el.remove();
  });
});
