/**
 * Viewport wheel/key bindings on the **Mac** platform branch.
 *
 * The sibling `viewport.integration.test.tsx` runs on the non-Mac branch, where
 * `mods: { mod: true }` resolves to ctrlKey. Everything Mac-specific — `mod` →
 * metaKey, and the bare-ctrl trackpad-pinch binding the browser synthesizes as
 * ctrl+wheel — is only reachable here.
 *
 * jsdom reports `navigator.platform === ''`, so the platform branch is chosen
 * from the user agent. The stub below is installed before the dispatcher module
 * is imported, because `IS_MAC` is a module-level constant.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    configurable: true,
  });
});

import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/registry';
import { DepRegistryProvider, useDepRegistry } from '../actions/depRegistry';
import '../actions/depSchema';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
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

function MountDispatcher({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const registry = useActionsRegistry();
  useGestureDispatcher({ canvasRef, actions: registry!, toolsById: new Map() });
  return <canvas ref={canvasRef} data-testid="canvas" />;
}

function RegisterViewDep({ viewApi }: { viewApi: ViewApi }) {
  const registry = useDepRegistry();
  registry.register('view', () => viewApi);
  return null;
}

function RegisterViewportActions() {
  const registry = useActionsRegistry();
  if (registry && !registry.list().find((a) => a.id === 'viewport.wheelPan')) {
    registry.register(viewportWheelPanAction);
  }
  if (registry && !registry.list().find((a) => a.id === 'viewport.zoom')) {
    registry.register(viewportZoomAction);
  }
  return null;
}

function buildHarness(viewApi: ViewApi) {
  return function Harness() {
    const ref = useRef<HTMLCanvasElement | null>(null);
    return (
      <DepRegistryProvider>
        <ActiveToolContextProvider>
          <ActionsProvider>
            <RegisterViewDep viewApi={viewApi} />
            <RegisterViewportActions />
            <MountDispatcher canvasRef={ref} />
          </ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>
    );
  };
}

/** Fires a wheel event and reports whether a binding claimed it. The dispatcher
 *  only calls `preventDefault` on a handled wheel, so this doubles as the
 *  "did the browser keep the event" assertion. */
function fireWheel(
  canvas: HTMLElement,
  opts: { deltaX?: number; deltaY?: number; ctrlKey?: boolean; metaKey?: boolean; clientX?: number; clientY?: number } = {},
): boolean {
  const ev = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaX: opts.deltaX ?? 0,
    deltaY: opts.deltaY ?? 0,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
  });
  canvas.dispatchEvent(ev);
  return ev.defaultPrevented;
}

function fireKey(key: string, opts: { ctrlKey?: boolean; metaKey?: boolean } = {}) {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key,
      ctrlKey: opts.ctrlKey ?? false,
      metaKey: opts.metaKey ?? false,
    }),
  );
}

// ---------------------------------------------------------------------------
// Platform branch
// ---------------------------------------------------------------------------

describe('mac platform branch', () => {
  it('resolves `mod` to metaKey: Cmd+= zooms in and Ctrl+= does not', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    render(<Harness />);

    act(() => { fireKey('=', { metaKey: true }); });
    // KEY_STEP is 1.25, anchored at the origin with no hostSize wired.
    expect(viewApi.current.scale).toEqual({ x: 1.25, y: 1.25 });

    // Ctrl+= is not Cmd+= on a Mac — Ctrl+click is the context menu, and the
    // matcher must keep the two apart.
    act(() => { fireKey('=', { ctrlKey: true }); });
    expect(viewApi.current.scale).toEqual({ x: 1.25, y: 1.25 });
  });
});

// ---------------------------------------------------------------------------
// Trackpad pinch — the browser delivers it as ctrl+wheel
// ---------------------------------------------------------------------------

describe('mac trackpad pinch (ctrl+wheel)', () => {
  it('zooms the view and prevents the browser default', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    const { getByTestId } = render(<Harness />);

    let prevented = false;
    act(() => {
      // WHEEL_STEP ** 1 — one notch of pinch-out.
      prevented = fireWheel(getByTestId('canvas'), { deltaY: -100, ctrlKey: true });
    });

    expect(viewApi.current.scale.x).toBeCloseTo(1.1, 10);
    expect(viewApi.current.scale.y).toBeCloseTo(1.1, 10);
    // Unprevented, the browser zooms the whole page instead of the canvas.
    expect(prevented).toBe(true);
  });

  it('does not pan — wheelPan forbids ctrl', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    const { getByTestId } = render(<Harness />);

    act(() => { fireWheel(getByTestId('canvas'), { deltaX: 40, deltaY: 60, ctrlKey: true }); });

    expect(viewApi.current.x).toBe(0);
    expect(viewApi.current.y).toBe(0);
  });

  it('leaves Cmd+wheel zoom intact', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    const { getByTestId } = render(<Harness />);

    act(() => { fireWheel(getByTestId('canvas'), { deltaY: -100, metaKey: true }); });

    expect(viewApi.current.scale.x).toBeCloseTo(1.1, 10);
  });

  it('leaves plain-wheel pan intact', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 2, y: 2 } });
    const Harness = buildHarness(viewApi);
    const { getByTestId } = render(<Harness />);

    act(() => { fireWheel(getByTestId('canvas'), { deltaX: 40, deltaY: 60 }); });

    expect(viewApi.current.x).toBe(20);
    expect(viewApi.current.y).toBe(30);
    expect(viewApi.current.scale).toEqual({ x: 2, y: 2 });
  });
});
