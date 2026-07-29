/**
 * Tests for the dispatcher-side inputs to `CanvasHelpers.getGestureBounds()`.
 * Uses the same fake-dispatcher shape as `useDispatcherOverlayLayer.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';
import type { OngoingHandle, OngoingOverlay } from 'interactions/actions/invoker';
import {
  createGestureSource,
  dispatcherGestureIds,
  dispatcherInsertBounds,
} from './dispatcherGestureBounds';

function makeDispatcher(
  handles: OngoingHandle[],
  extra?: Partial<Pick<Dispatcher, 'subscribe' | 'getVersion'>>,
): Dispatcher {
  const map = new Map<string, OngoingHandle>(handles.map((h, i) => [`gid-${i}`, h]));
  return {
    handleInput: () => 'unhandled',
    resolveOnly: () => null,
    resolveAll: () => [],
    cancelAll: () => {},
    inFlightCursor: () => null,
    inFlight: () => map,
    getInFlightHandles: () => map.values(),
    subscribe: () => () => {},
    getVersion: () => 0,
    getActiveAction: () => ({ kind: null, id: null }),
    beginUiOngoing: () => null,
    ...extra,
  };
}

const insertOverlay = (
  bounds: { x: number; y: number; width: number; height: number },
  shape: Extract<OngoingOverlay, { kind: 'insertPreview' }>['shape'] = 'rect',
): OngoingHandle => ({
  overlay: (): OngoingOverlay => ({ kind: 'insertPreview', shape, bounds, extras: {} }),
});

describe('dispatcherGestureIds', () => {
  it('returns [] with no dispatcher', () => {
    expect(dispatcherGestureIds(null)).toEqual([]);
    expect(dispatcherGestureIds(undefined)).toEqual([]);
  });

  it('returns [] when nothing is in flight', () => {
    expect(dispatcherGestureIds(makeDispatcher([]))).toEqual([]);
  });

  it('collects previewIds from every in-flight handle', () => {
    const d = makeDispatcher([
      { previewIds: () => ['a', 'b'] },
      { previewIds: () => ['c'] },
    ]);
    expect(dispatcherGestureIds(d).sort()).toEqual(['a', 'b', 'c']);
  });

  it('includes handles that opt out of source-hiding (clone ghosts)', () => {
    // previewIdsExtra filters these out — gesture bounds must not.
    const d = makeDispatcher([{ previewHidesSource: false, previewIds: () => ['clone-src'] }]);
    expect(dispatcherGestureIds(d)).toEqual(['clone-src']);
  });

  it('skips handles with no previewIds at all', () => {
    const d = makeDispatcher([{ onMove: () => {} }, { previewIds: () => null }]);
    expect(dispatcherGestureIds(d)).toEqual([]);
  });
});

describe('dispatcherInsertBounds', () => {
  it('returns [] with no dispatcher and when nothing is in flight', () => {
    expect(dispatcherInsertBounds(null)).toEqual([]);
    expect(dispatcherInsertBounds(makeDispatcher([]))).toEqual([]);
  });

  it('reports the AABB of an insertPreview overlay', () => {
    const d = makeDispatcher([insertOverlay({ x: 10, y: 20, width: 30, height: 40 })]);
    expect(dispatcherInsertBounds(d)).toEqual([{ x: 10, y: 20, width: 30, height: 40 }]);
  });

  it('reports one entry per in-flight insert', () => {
    const d = makeDispatcher([
      insertOverlay({ x: 0, y: 0, width: 5, height: 5 }),
      insertOverlay({ x: 100, y: 0, width: 5, height: 5 }),
    ]);
    expect(dispatcherInsertBounds(d)).toHaveLength(2);
  });

  it('ignores marquee overlays — a selection sweep proposes no content', () => {
    const marquee: OngoingHandle = {
      overlay: (): OngoingOverlay => ({
        kind: 'marquee',
        start: { x: 0, y: 0 },
        current: { x: 500, y: 500 },
        shiftHeld: false,
      }),
    };
    expect(dispatcherInsertBounds(makeDispatcher([marquee]))).toEqual([]);
  });

  it('ignores lasso and commands overlays', () => {
    const lasso: OngoingHandle = {
      overlay: (): OngoingOverlay => ({
        kind: 'lasso',
        vertices: [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 9 }],
        current: { x: 9, y: 9 },
        shiftHeld: false,
      }),
    };
    const commands: OngoingHandle = {
      overlay: (): OngoingOverlay => ({ kind: 'commands', commands: [] }),
    };
    expect(dispatcherInsertBounds(makeDispatcher([lasso, commands]))).toEqual([]);
  });

  it('skips a zero-area preview (pointerdown before the first move)', () => {
    const d = makeDispatcher([insertOverlay({ x: 7, y: 7, width: 0, height: 0 })]);
    expect(dispatcherInsertBounds(d)).toEqual([]);
  });

  it('keeps a zero-area pencil preview — matches the overlay layer', () => {
    const d = makeDispatcher([insertOverlay({ x: 7, y: 7, width: 0, height: 0 }, 'pencil')]);
    expect(dispatcherInsertBounds(d)).toEqual([{ x: 7, y: 7, width: 0, height: 0 }]);
  });

  it('ignores handles with no overlay', () => {
    expect(dispatcherInsertBounds(makeDispatcher([{ previewIds: () => ['a'] }]))).toEqual([]);
  });
});

describe('createGestureSource', () => {
  it('reads the dispatcher through the getter, so a later instance still counts', () => {
    let dispatcher: Dispatcher | null = null;
    const source = createGestureSource(() => dispatcher);
    // Before the dispatcher exists: empty answers, never a throw.
    expect([...(source.ids() ?? [])]).toEqual([]);
    expect([...(source.bounds() ?? [])]).toEqual([]);

    dispatcher = makeDispatcher([
      { previewIds: () => ['a'] },
      insertOverlay({ x: 0, y: 0, width: 4, height: 4 }),
    ]);
    expect([...(source.ids() ?? [])]).toEqual(['a']);
    expect([...(source.bounds() ?? [])]).toEqual([{ x: 0, y: 0, width: 4, height: 4 }]);
  });

  it('forwards subscribe + getVersion to the dispatcher', () => {
    const subscribers = new Set<() => void>();
    let version = 3;
    const dispatcher = makeDispatcher([], {
      subscribe: (fn) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
      getVersion: () => version,
    });
    const source = createGestureSource(() => dispatcher);

    let fired = 0;
    const unsubscribe = source.subscribe(() => { fired++; });
    expect(source.getVersion()).toBe(3);

    version = 4;
    for (const fn of subscribers) fn();
    expect(fired).toBe(1);
    expect(source.getVersion()).toBe(4);

    unsubscribe();
    for (const fn of subscribers) fn();
    expect(fired).toBe(1);
  });

  it('with no dispatcher: a real but never-firing subscription and version 0', () => {
    const source = createGestureSource(() => null);
    let fired = 0;
    const unsubscribe = source.subscribe(() => { fired++; });
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
    expect(fired).toBe(0);
    expect(source.getVersion()).toBe(0);
  });
});
