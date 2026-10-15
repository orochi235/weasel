import { describe, it, expect } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { stubDeps } from '../testUtils';
import { makeViewportZoomAction } from './viewportZoom';
import { makePinchZoomAction } from './pinchZoom';
import { axisZoomFactor } from 'core/viewport/zoomAt';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../depSchema';

function makeView(initial: View): ViewApi & { current: View } {
  const api = {
    current: initial,
    get() { return api.current; },
    set(v: View) { api.current = v; },
    hostSize: () => ({ width: 200, height: 100 }),
  };
  return api;
}

function run(axis: 'both' | 'x' | 'y' | undefined, params: Record<string, unknown>): View {
  const view = makeView({ x: 10, y: 20, scale: { x: 1, y: 1 } });
  const action = makeViewportZoomAction(axis === undefined ? {} : { axis });
  if (action.invoker?.timing !== 'immediate') throw new Error('Expected immediate invoker');
  action.invoker.run({ view }, params);
  return view.current;
}

describe('axisZoomFactor', () => {
  it('leaves a factor alone under both, and holds the other axis at 1', () => {
    expect(axisZoomFactor(2, 'both')).toBe(2);
    expect(axisZoomFactor(2, 'x')).toEqual({ x: 2, y: 1 });
    expect(axisZoomFactor(2, 'y')).toEqual({ x: 1, y: 2 });
  });
});

describe('makeViewportZoomAction axis', () => {
  const wheel = { kind: 'wheel', deltaY: -100, deltaX: 0, clientX: 50, clientY: 50 };

  it('zooms both axes when axis is omitted', () => {
    const next = run(undefined, wheel);
    expect(next.scale.x).toBeGreaterThan(1);
    expect(next.scale.y).toBe(next.scale.x);
  });

  it("holds y scale and y translation under axis: 'x' on a wheel", () => {
    const next = run('x', wheel);
    expect(next.scale.x).toBeGreaterThan(1);
    expect(next.scale.y).toBe(1);
    expect(next.y).toBe(20);
    // The world point under the pointer stays put on the zoomed axis.
    expect(50 / next.scale.x + next.x).toBeCloseTo(60, 6);
  });

  it("holds x scale and x translation under axis: 'y' on a wheel", () => {
    const next = run('y', wheel);
    expect(next.scale.y).toBeGreaterThan(1);
    expect(next.scale.x).toBe(1);
    expect(next.x).toBe(10);
  });

  it('holds the other axis on a trackpad pinch sample', () => {
    const next = run('x', { kind: 'pinch', scale: 2, clientX: 0, clientY: 0 });
    expect(next.scale).toEqual({ x: 2, y: 1 });
  });

  it('holds the other axis on the zoom keys', () => {
    const zoomedIn = run('y', { kind: 'in' });
    expect(zoomedIn.scale).toEqual({ x: 1, y: 1.25 });
    expect(zoomedIn.x).toBe(10);
    const zoomedOut = run('x', { kind: 'out' });
    expect(zoomedOut.scale).toEqual({ x: 0.8, y: 1 });
    expect(zoomedOut.y).toBe(20);
  });
});

describe('makePinchZoomAction axis', () => {
  function pinch(axis: 'x' | 'y'): View {
    const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const action = makePinchZoomAction({ axis });
    if (action.invoker?.timing !== 'ongoing') throw new Error('Expected ongoing invoker');
    const base = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    };
    const centroid = { x: 100, y: 100 };
    const start: InvocationCtx = {
      ...base,
      deps: stubDeps({ view }),
      multiTouch: { centroid, spread: 100, rotation: 0 },
    };
    const handle = action.invoker.start(start, undefined);
    handle.onMove?.({
      ...base,
      deps: {},
      multiTouch: {
        centroid,
        spread: 200,
        rotation: 0,
        pinch: { startSpread: 100, currentSpread: 200, centroid },
      },
    });
    return view.current;
  }

  it("scales only x under axis: 'x'", () => {
    expect(pinch('x').scale).toEqual({ x: 2, y: 1 });
  });

  it("scales only y under axis: 'y'", () => {
    expect(pinch('y').scale).toEqual({ x: 1, y: 2 });
  });
});
