/**
 * Phase 8.5 — end-to-end integration tests for viewportWheelPanAction and
 * viewportZoomAction via the gesture dispatcher.
 *
 * Proves:
 *   - plain wheel event → pan (viewportWheelPanAction fires, view.x/y updates)
 *   - Cmd+wheel event → zoom (viewportZoomAction fires, view.scale updates)
 *   - Cmd+= keydown → zoom in
 *   - Cmd+- keydown → zoom out
 *   - Cmd+0 keydown → zoom reset
 *
 * ## Provider tree
 *
 *   DepRegistryProvider > ActiveToolContextProvider
 *     > ActionsProvider > [MountDispatcher + RegisterViewDep + RegisterViewportActions]
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/registry';
import { DepRegistryProvider, useDepRegistry } from '../actions/depRegistry';
import '../actions/depSchema'; // augments DepSchema
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
import { viewportWheelPanAction } from '../actions/defaults/viewportWheelPan';
import { viewportZoomAction } from '../actions/defaults/viewportZoom';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../actions/depSchema';

// ---------------------------------------------------------------------------
// Canvas mock (required for JSDOM which lacks canvas context)
// ---------------------------------------------------------------------------

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
// Platform detection: force non-mac so `mod` = ctrlKey in tests
// ---------------------------------------------------------------------------
// Tests fire ctrlKey: true to simulate Cmd/Ctrl on non-Mac. IS_MAC is derived
// at module load time in useGestureDispatcher; tests run in jsdom which reports
// a Linux user-agent, so mod → ctrlKey is the expected path.

// ---------------------------------------------------------------------------
// Test harness components
// ---------------------------------------------------------------------------

/** Simple mutable view API backed by a plain object. */
function makeViewApi(initial: View): ViewApi & { current: View } {
  const api = {
    current: { ...initial },
    get() { return api.current; },
    set(v: View) { api.current = { ...v }; },
  };
  return api;
}

/** Mounts the gesture dispatcher on the canvas element. */
function MountDispatcher({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const registry = useActionsRegistry();
  useGestureDispatcher({ canvasRef, actions: registry!, toolsById: new Map() });
  return <canvas ref={canvasRef} data-testid="canvas" />;
}

/** Registers a live 'view' dep source. */
function RegisterViewDep({ viewApi }: { viewApi: ViewApi }) {
  const registry = useDepRegistry();
  registry.register('view', () => viewApi);
  return null;
}

/** Registers viewport action descriptors. */
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
  function Harness() {
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
  }
  return Harness;
}

/** Fire a WheelEvent on the canvas element. */
function fireWheel(
  canvas: HTMLElement,
  opts: { deltaX?: number; deltaY?: number; ctrlKey?: boolean; clientX?: number; clientY?: number } = {},
) {
  canvas.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      deltaX: opts.deltaX ?? 0,
      deltaY: opts.deltaY ?? 0,
      ctrlKey: opts.ctrlKey ?? false,
      clientX: opts.clientX ?? 0,
      clientY: opts.clientY ?? 0,
    }),
  );
}

/** Fire a KeyboardEvent on the window. */
function fireKey(
  key: string,
  opts: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {},
) {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      key,
      ctrlKey: opts.ctrlKey ?? false,
      metaKey: opts.metaKey ?? false,
      shiftKey: opts.shiftKey ?? false,
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('viewportWheelPanAction integration', () => {
  it('plain wheel event pans the view by deltaX/deltaY / scale', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 2, y: 2 } });
    const Harness = buildHarness(viewApi);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => {
      fireWheel(canvas, { deltaX: 40, deltaY: 60, ctrlKey: false });
    });

    // dx = 40/2 = 20, dy = 60/2 = 30
    expect(viewApi.current.x).toBeCloseTo(20, 5);
    expect(viewApi.current.y).toBeCloseTo(30, 5);
    // Scale unchanged.
    expect(viewApi.current.scale).toEqual({ x: 2, y: 2 });
  });

  it('ctrl+wheel does NOT pan (claimed by zoom)', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => {
      fireWheel(canvas, { deltaX: 0, deltaY: 100, ctrlKey: true });
    });

    // Zoom fired — view x/y should be 0 (no pan), scale changed
    expect(viewApi.current.x).toBe(0);
    expect(viewApi.current.y).toBe(0);
    expect(viewApi.current.scale.x).not.toBe(1); // zoom occurred
  });
});

describe('viewportZoomAction integration', () => {
  it('ctrl+wheel zooms (scale changes)', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Positive deltaY = scroll down = zoom out
      fireWheel(canvas, { deltaY: 100, ctrlKey: true, clientX: 0, clientY: 0 });
    });

    expect(viewApi.current.scale.x).toBeLessThan(1);
    expect(viewApi.current.scale.y).toBeLessThan(1);
  });

  it('Ctrl+= zooms in', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    render(<Harness />);

    act(() => {
      fireKey('=', { ctrlKey: true });
    });

    expect(viewApi.current.scale.x).toBeGreaterThan(1);
  });

  it('Ctrl+- zooms out', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    render(<Harness />);

    act(() => {
      fireKey('-', { ctrlKey: true });
    });

    expect(viewApi.current.scale.x).toBeLessThan(1);
  });

  it('Ctrl+0 resets zoom to 1', () => {
    const viewApi = makeViewApi({ x: 50, y: 30, scale: { x: 3, y: 3 } });
    const Harness = buildHarness(viewApi);
    render(<Harness />);

    act(() => {
      fireKey('0', { ctrlKey: true });
    });

    expect(viewApi.current.scale).toEqual({ x: 1, y: 1 });
    expect(viewApi.current.x).toBe(0);
    expect(viewApi.current.y).toBe(0);
  });
});
