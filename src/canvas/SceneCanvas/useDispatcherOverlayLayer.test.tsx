/**
 * Tests for `useDispatcherOverlayLayer` — Phase 14e.2.5 dispatcher-side
 * chrome surface. When a dispatcher's in-flight `OngoingHandle` exposes
 * `overlay()` returning `{ kind: 'marquee', ... }` or `{ kind: 'lasso', ... }`,
 * the layer paints the matching shape. Removing the handle removes the paint.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { View } from 'core/viewport/view';
import type { DrawCommand, PathDrawCommand } from '../../renderer';
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';
import type { OngoingHandle, OngoingOverlay } from 'interactions/actions/invoker';
import { useDispatcherOverlayLayer } from './useDispatcherOverlayLayer';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 800, height: 600 };

function makeDispatcher(handles: OngoingHandle[]): Dispatcher {
  const map = new Map<string, OngoingHandle>(handles.map((h, i) => [`gid-${i}`, h]));
  return {
    handleInput: () => 'unhandled',
    cancelAll: () => {},
    inFlight: () => map,
    getInFlightHandles: () => map.values(),
    subscribe: () => () => {},
    getActiveAction: () => ({ kind: null, id: null }),
    beginUiOngoing: () => null,
  };
}

/** Pull all top-level path commands out of the layer's draw output. */
function collectPaths(cmds: DrawCommand[]): PathDrawCommand[] {
  const out: PathDrawCommand[] = [];
  for (const c of cmds) if (c.kind === 'path') out.push(c);
  return out;
}

describe('useDispatcherOverlayLayer', () => {
  it('emits a screen-space rect for a marquee overlay', () => {
    const handle: OngoingHandle = {
      overlay: (): OngoingOverlay => ({
        kind: 'marquee',
        start: { x: 10, y: 20 },
        current: { x: 110, y: 80 },
        shiftHeld: false,
      }),
    };
    const dispatcher = makeDispatcher([handle]);
    const { result } = renderHook(() => useDispatcherOverlayLayer({ dispatcher }));

    const cmds = result.current.draw(undefined, VIEW, DIMS);
    const paths = collectPaths(cmds);
    expect(paths).toHaveLength(1);
    expect(paths[0].path).toEqual({ kind: 'rect', x: 10, y: 20, width: 100, height: 60 });
    // Stroke + fill present (chrome paint).
    expect(paths[0].fill).toBeDefined();
    expect(paths[0].stroke).toBeDefined();
    // Screen-space layer — declare it so the renderer doesn't apply the view transform.
    expect(result.current.space).toBe('screen');
  });

  it('emits a closed polygon path for a lasso overlay', () => {
    const handle: OngoingHandle = {
      overlay: (): OngoingOverlay => ({
        kind: 'lasso',
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        current: { x: 10, y: 10 },
        shiftHeld: false,
      }),
    };
    const dispatcher = makeDispatcher([handle]);
    const { result } = renderHook(() => useDispatcherOverlayLayer({ dispatcher }));

    const cmds = result.current.draw(undefined, VIEW, DIMS);
    const paths = collectPaths(cmds);
    expect(paths).toHaveLength(1);
    expect(paths[0].path.kind).toBe('polygon');
    // polygonFromPoints encodes M, L, L, ..., Z — 3 verts → 1 M, 2 L, 1 Z = 4 commands.
    const polygon = paths[0].path as Extract<typeof paths[0]['path'], { kind: 'polygon' }>;
    expect(polygon.commands.length).toBe(4);
  });

  it('skips degenerate lasso (<2 vertices) without emitting a path', () => {
    const handle: OngoingHandle = {
      overlay: (): OngoingOverlay => ({
        kind: 'lasso',
        vertices: [{ x: 0, y: 0 }],
        current: { x: 0, y: 0 },
        shiftHeld: false,
      }),
    };
    const dispatcher = makeDispatcher([handle]);
    const { result } = renderHook(() => useDispatcherOverlayLayer({ dispatcher }));

    const cmds = result.current.draw(undefined, VIEW, DIMS);
    expect(collectPaths(cmds)).toHaveLength(0);
  });

  it('emits nothing when no handle exposes overlay()', () => {
    // Handle without overlay() — should not error, should not emit paths.
    const handle: OngoingHandle = { onMove: () => {} };
    const dispatcher = makeDispatcher([handle]);
    const { result } = renderHook(() => useDispatcherOverlayLayer({ dispatcher }));

    expect(collectPaths(result.current.draw(undefined, VIEW, DIMS))).toHaveLength(0);
  });

  it('emits nothing once the in-flight handle is gone (commit/cancel)', () => {
    const handle: OngoingHandle = {
      overlay: (): OngoingOverlay => ({
        kind: 'marquee',
        start: { x: 0, y: 0 },
        current: { x: 50, y: 50 },
        shiftHeld: false,
      }),
    };
    // Before: one in-flight.
    const d1 = makeDispatcher([handle]);
    const { result: r1 } = renderHook(() => useDispatcherOverlayLayer({ dispatcher: d1 }));
    expect(collectPaths(r1.current.draw(undefined, VIEW, DIMS))).toHaveLength(1);

    // After: empty in-flight map.
    const d2 = makeDispatcher([]);
    const { result: r2 } = renderHook(() => useDispatcherOverlayLayer({ dispatcher: d2 }));
    expect(collectPaths(r2.current.draw(undefined, VIEW, DIMS))).toHaveLength(0);
  });

  it('scales marquee dimensions by view.scale', () => {
    const handle: OngoingHandle = {
      overlay: (): OngoingOverlay => ({
        kind: 'marquee',
        start: { x: 0, y: 0 },
        current: { x: 100, y: 100 },
        shiftHeld: false,
      }),
    };
    const dispatcher = makeDispatcher([handle]);
    const { result } = renderHook(() => useDispatcherOverlayLayer({ dispatcher }));
    const zoomedView: View = { x: 0, y: 0, scale: { x: 2, y: 2 } };

    const paths = collectPaths(result.current.draw(undefined, zoomedView, DIMS));
    expect(paths[0].path).toEqual({ kind: 'rect', x: 0, y: 0, width: 200, height: 200 });
  });

  describe('chrome-caps visibility gate', () => {
    const data = (allow: Set<string>) => ({
      getIsVisible: () => (id: string) => allow.has(id),
    });
    const marqueeHandle: OngoingHandle = {
      overlay: (): OngoingOverlay => ({
        kind: 'marquee', start: { x: 0, y: 0 }, current: { x: 10, y: 10 }, shiftHeld: false,
      }),
    };
    const lassoHandle: OngoingHandle = {
      overlay: (): OngoingOverlay => ({
        kind: 'lasso',
        vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
        current: { x: 10, y: 10 }, shiftHeld: false,
      }),
    };

    it('hides the marquee overlay when action.marquee reports false', () => {
      const dispatcher = makeDispatcher([marqueeHandle]);
      const { result } = renderHook(() => useDispatcherOverlayLayer({ dispatcher }));
      const allow = data(new Set([])); // nothing visible
      expect(collectPaths(result.current.draw(allow, VIEW, DIMS))).toHaveLength(0);
      const allowMarquee = data(new Set(['action.marquee']));
      expect(collectPaths(result.current.draw(allowMarquee, VIEW, DIMS))).toHaveLength(1);
    });

    it('hides the lasso overlay when action.lasso reports false', () => {
      const dispatcher = makeDispatcher([lassoHandle]);
      const { result } = renderHook(() => useDispatcherOverlayLayer({ dispatcher }));
      const allow = data(new Set([]));
      expect(collectPaths(result.current.draw(allow, VIEW, DIMS))).toHaveLength(0);
      const allowLasso = data(new Set(['action.lasso']));
      expect(collectPaths(result.current.draw(allowLasso, VIEW, DIMS))).toHaveLength(1);
    });

    it('absent getIsVisible → every overlay paints (legacy behavior)', () => {
      const dispatcher = makeDispatcher([marqueeHandle, lassoHandle]);
      const { result } = renderHook(() => useDispatcherOverlayLayer({ dispatcher }));
      expect(collectPaths(result.current.draw(undefined, VIEW, DIMS))).toHaveLength(2);
    });
  });
});
