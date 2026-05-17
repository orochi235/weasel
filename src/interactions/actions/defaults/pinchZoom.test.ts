import { describe, it, expect } from 'vitest';
import { pinchZoomAction } from './pinchZoom';
import type { InvocationCtx } from '../invoker';
import type { ViewApi } from '../depSchema';
import type { View } from 'core/viewport/view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViewApi(initial: View): ViewApi & { current: View } {
  const api = {
    current: { ...initial },
    get() { return api.current; },
    set(v: View) { api.current = { ...v }; },
  };
  return api;
}

function makeCtx(viewApi?: ViewApi, spreadOverride?: number): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: viewApi ? { view: viewApi } : { view: { x: 0, y: 0, scale: 1 } },
    multiTouch: {
      centroid: { x: 100, y: 100 },
      spread: spreadOverride ?? 100,
      rotation: 0,
    },
  };
}

function makeMoveCtx(centroid: { x: number; y: number }, currentSpread: number, startSpread: number): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {},
    multiTouch: {
      centroid,
      spread: currentSpread,
      rotation: 0,
      pinch: { startSpread, currentSpread, centroid },
    },
  };
}

function getOngoingInvoker(action: typeof pinchZoomAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pinchZoomAction descriptor', () => {
  it('declares id, label, multiTouch gestureBinding, and ongoing timing', () => {
    expect(pinchZoomAction.id).toBe('viewport.pinchZoom');
    expect(pinchZoomAction.label).toBe('Pinch Zoom');
    expect(pinchZoomAction.gestureBinding).toEqual({ kind: 'multiTouch', fingers: 2 });
    expect(pinchZoomAction.invoker?.timing).toBe('ongoing');
  });

  it('requires view dep', () => {
    expect(pinchZoomAction.requires).toContain('view');
  });

  it('enabled returns true (always enabled)', () => {
    expect(pinchZoomAction.enabled!()).toBe(true);
  });

  it('start returns empty handle when view dep is absent', () => {
    const invoker = getOngoingInvoker(pinchZoomAction);
    const emptyCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(emptyCtx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when multiTouch is absent', () => {
    const invoker = getOngoingInvoker(pinchZoomAction);
    const ctxNoMT: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { view: { x: 0, y: 0, scale: 1 } },
    };
    const handle = invoker.start(ctxNoMT, undefined);
    expect(handle).toEqual({});
  });

  it('start returns handle with onMove when view and multiTouch are present', () => {
    const invoker = getOngoingInvoker(pinchZoomAction);
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const handle = invoker.start(makeCtx(viewApi, 100), undefined);
    expect(typeof handle.onMove).toBe('function');
  });

  it('onMove zooms in when spread increases (factor > 1)', () => {
    const invoker = getOngoingInvoker(pinchZoomAction);
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    // Start: spread 100
    const handle = invoker.start(makeCtx(viewApi, 100), undefined);

    // Move: spread grows to 200 → factor = 200/100 = 2
    handle.onMove!(makeMoveCtx({ x: 100, y: 100 }, 200, 100));

    expect(viewApi.current.scale.x).toBeGreaterThan(1);
    expect(viewApi.current.scale.y).toBeGreaterThan(1);
  });

  it('onMove zooms out when spread decreases (factor < 1)', () => {
    const invoker = getOngoingInvoker(pinchZoomAction);
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    // Start: spread 100
    const handle = invoker.start(makeCtx(viewApi, 100), undefined);

    // Move: spread shrinks to 50 → factor = 50/100 = 0.5
    handle.onMove!(makeMoveCtx({ x: 100, y: 100 }, 50, 100));

    expect(viewApi.current.scale.x).toBeLessThan(1);
    expect(viewApi.current.scale.y).toBeLessThan(1);
  });

  it('onMove is a no-op when pinch field is absent from multiTouch', () => {
    const invoker = getOngoingInvoker(pinchZoomAction);
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const handle = invoker.start(makeCtx(viewApi, 100), undefined);

    const noopCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
      multiTouch: { centroid: { x: 100, y: 100 }, spread: 200, rotation: 0 },
      // pinch absent
    };
    handle.onMove!(noopCtx);

    // No change
    expect(viewApi.current.scale).toEqual({ x: 1, y: 1 });
  });
});
