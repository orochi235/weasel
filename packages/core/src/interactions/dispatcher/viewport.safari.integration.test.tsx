/**
 * Safari's trackpad pinch: WebKit `gesturestart` / `gesturechange` /
 * `gestureend`, which carry a `scale` cumulative from 1 at gesture start.
 * Safari can deliver the same physical pinch as ctrl+wheel too, so these tests
 * pin the rule that only one of the two drives zoom.
 *
 * jsdom has no `GestureEvent`: a plain cancelable `Event` with `scale` /
 * `rotation` / `clientX` / `clientY` assigned stands in for one.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    configurable: true,
  });
});

import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '@weasel-js/routing/react';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import '../actions/depSchema';
import { ActiveToolContextProvider } from '@weasel-js/routing/react';
import { useGestureDispatcher, type DispatcherChannels } from '@weasel-js/routing/react';
import type { Action } from '@weasel-js/routing';
import { viewportWheelPanAction } from '../actions/defaults/viewportWheelPan';
import { viewportZoomAction } from '../actions/defaults/viewportZoom';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../actions/depSchema';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function makeViewApi(initial: View): ViewApi & { current: View } {
  const api = {
    current: { ...initial },
    get() { return api.current; },
    set(v: View) { api.current = { ...v }; },
  };
  return api;
}

function buildHarness(
  viewApi: ViewApi,
  actions: readonly Action[] = [viewportWheelPanAction, viewportZoomAction],
  channels?: DispatcherChannels,
) {
  function Mount({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
    const registry = useActionsRegistry();
    useGestureDispatcher({ canvasRef, actions: registry!, toolsById: new Map(), channels });
    return <canvas ref={canvasRef} data-testid="canvas" />;
  }
  function Register() {
    const deps = useDepRegistry();
    deps.register('view', () => viewApi);
    const registry = useActionsRegistry();
    for (const a of actions) {
      if (registry && !registry.list().find((x) => x.id === a.id)) registry.register(a);
    }
    return null;
  }
  return function Harness() {
    const ref = useRef<HTMLCanvasElement | null>(null);
    return (
      <DepRegistryProvider>
        <ActiveToolContextProvider>
          <ActionsProvider>
            <Register />
            <Mount canvasRef={ref} />
          </ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>
    );
  };
}

/** Fires a stand-in WebKit GestureEvent; returns whether it was prevented. */
function fireGesture(
  canvas: HTMLElement,
  type: 'gesturestart' | 'gesturechange' | 'gestureend',
  opts: { scale?: number; rotation?: number; clientX?: number; clientY?: number } = {},
): boolean {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, {
    scale: opts.scale ?? 1,
    rotation: opts.rotation ?? 0,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
  });
  canvas.dispatchEvent(ev);
  return ev.defaultPrevented;
}

function fireCtrlWheel(canvas: HTMLElement, deltaY: number): boolean {
  const ev = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY, ctrlKey: true });
  canvas.dispatchEvent(ev);
  return ev.defaultPrevented;
}

function renderHarness(...args: Parameters<typeof buildHarness>) {
  const Harness = buildHarness(...args);
  return render(<Harness />);
}

const unit = (): View => ({ x: 0, y: 0, scale: { x: 1, y: 1 } });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Safari gesture pinch', () => {
  it('zooms by the cumulative scale, not by each sample compounded', () => {
    const viewApi = makeViewApi(unit());
    const { getByTestId } = renderHarness(viewApi);
    const canvas = getByTestId('canvas');

    act(() => {
      fireGesture(canvas, 'gesturestart');
      fireGesture(canvas, 'gesturechange', { scale: 1.5 });
      fireGesture(canvas, 'gesturechange', { scale: 2 });
      fireGesture(canvas, 'gestureend', { scale: 2 });
    });

    expect(viewApi.current.scale.x).toBeCloseTo(2, 10);
    expect(viewApi.current.scale.y).toBeCloseTo(2, 10);
  });

  it('prevents the default on every gesture event it claims, so Safari does not zoom the page', () => {
    const viewApi = makeViewApi(unit());
    const { getByTestId } = renderHarness(viewApi);
    const canvas = getByTestId('canvas');

    let start = false; let change = false;
    act(() => {
      start = fireGesture(canvas, 'gesturestart');
      change = fireGesture(canvas, 'gesturechange', { scale: 1.2 });
      fireGesture(canvas, 'gestureend', { scale: 1.2 });
    });

    expect(start).toBe(true);
    expect(change).toBe(true);
  });

  it('anchors at the focal point in canvas-local coordinates', () => {
    const viewApi = makeViewApi(unit());
    const { getByTestId } = renderHarness(viewApi);
    const canvas = getByTestId('canvas');
    canvas.getBoundingClientRect = () => ({
      left: 10, top: 20, right: 410, bottom: 320, width: 400, height: 300, x: 10, y: 20,
      toJSON: () => ({}),
    });

    act(() => {
      fireGesture(canvas, 'gesturestart', { clientX: 110, clientY: 70 });
      fireGesture(canvas, 'gesturechange', { scale: 2, clientX: 110, clientY: 70 });
      fireGesture(canvas, 'gestureend', { scale: 2, clientX: 110, clientY: 70 });
    });

    // Canvas-local focal (100, 50) keeps the world point under it.
    expect(viewApi.current.scale.x).toBeCloseTo(2, 10);
    expect(100 / viewApi.current.scale.x + viewApi.current.x).toBeCloseTo(100, 10);
    expect(50 / viewApi.current.scale.y + viewApi.current.y).toBeCloseTo(50, 10);
  });

  it('swallows ctrl+wheel while a claimed gesture is live, so one pinch zooms once', () => {
    const viewApi = makeViewApi(unit());
    const { getByTestId } = renderHarness(viewApi);
    const canvas = getByTestId('canvas');

    let wheelPrevented = false;
    act(() => {
      fireGesture(canvas, 'gesturestart');
      fireGesture(canvas, 'gesturechange', { scale: 1.5 });
      // Safari's ctrl+wheel copy of the same pinch.
      wheelPrevented = fireCtrlWheel(canvas, -100);
    });

    expect(viewApi.current.scale.x).toBeCloseTo(1.5, 10);
    // Swallowed, not passed through: unprevented, the page would zoom.
    expect(wheelPrevented).toBe(true);
  });

  it('lets ctrl+wheel zoom again once the gesture ends', () => {
    const viewApi = makeViewApi(unit());
    const { getByTestId } = renderHarness(viewApi);
    const canvas = getByTestId('canvas');

    act(() => {
      fireGesture(canvas, 'gesturestart');
      fireGesture(canvas, 'gesturechange', { scale: 1.5 });
      fireGesture(canvas, 'gestureend', { scale: 1.5 });
      fireCtrlWheel(canvas, -100);
    });

    expect(viewApi.current.scale.x).toBeCloseTo(1.5 * 1.1, 10);
  });

  it('ends the gesture on window blur, since the gestureend may never arrive', () => {
    const viewApi = makeViewApi(unit());
    const { getByTestId } = renderHarness(viewApi);
    const canvas = getByTestId('canvas');

    act(() => {
      fireGesture(canvas, 'gesturestart');
      window.dispatchEvent(new Event('blur'));
      fireCtrlWheel(canvas, -100);
    });

    expect(viewApi.current.scale.x).toBeCloseTo(1.1, 10);
  });

  it('leaves the gesture to the browser, and ctrl+wheel to its binding, when nothing binds pinch', () => {
    const viewApi = makeViewApi(unit());
    const wheelRun = vi.fn();
    const ctrlWheelOnly: Action = {
      id: 'probe.ctrlWheel',
      label: 'probe',
      defaultBinding: { kind: 'wheel', mods: { ctrl: true } },
      invoker: { timing: 'immediate', run: wheelRun },
    };
    const { getByTestId } = renderHarness(viewApi, [ctrlWheelOnly]);
    const canvas = getByTestId('canvas');

    let start = true; let change = true;
    act(() => {
      start = fireGesture(canvas, 'gesturestart');
      change = fireGesture(canvas, 'gesturechange', { scale: 1.5 });
      fireCtrlWheel(canvas, -100);
    });

    expect(start).toBe(false);
    expect(change).toBe(false);
    expect(wheelRun).toHaveBeenCalledOnce();
  });

  it('attaches nothing when the pinch channel is off', () => {
    const viewApi = makeViewApi(unit());
    const { getByTestId } = renderHarness(viewApi, undefined, { pinch: false });
    const canvas = getByTestId('canvas');

    let start = true;
    act(() => {
      start = fireGesture(canvas, 'gesturestart');
      fireGesture(canvas, 'gesturechange', { scale: 2 });
    });

    expect(start).toBe(false);
    expect(viewApi.current.scale.x).toBe(1);
  });
});
