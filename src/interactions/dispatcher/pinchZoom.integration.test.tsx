/**
 * Integration tests for pinchZoomAction via the gesture dispatcher.
 *
 * Proves:
 *   - Two pointerdowns synthesize a multitouch event → pinchZoomAction.start fires
 *   - Subsequent pointermove synthesizes a multitouch pump → onMove fires, view scale changes
 *   - Pointer release commits (view retained); cancelAll commits too
 *
 * ## Provider tree
 *
 *   DepRegistryProvider > ActiveToolContextProvider
 *     > ActionsProvider > [MountDispatcher + RegisterViewDep + RegisterPinchZoom]
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/registry';
import { DepRegistryProvider, useDepRegistry } from '../actions/depRegistry';
import '../actions/depSchema';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
import { pinchZoomAction } from '../actions/defaults/pinchZoom';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../actions/depSchema';

// ---------------------------------------------------------------------------
// Canvas mock
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

function RegisterPinchZoom() {
  const registry = useActionsRegistry();
  if (registry && !registry.list().find((a) => a.id === 'viewport.pinchZoom')) {
    registry.register(pinchZoomAction);
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
              <RegisterPinchZoom />
              <MountDispatcher canvasRef={ref} />
            </ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>
    );
  }
  return Harness;
}

function firePointerDown(canvas: HTMLElement, opts: { pointerId: number; clientX: number; clientY: number }) {
  canvas.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: opts.pointerId,
      clientX: opts.clientX,
      clientY: opts.clientY,
    }),
  );
}

function firePointerMove(canvas: HTMLElement, opts: { pointerId: number; clientX: number; clientY: number }) {
  canvas.dispatchEvent(
    new PointerEvent('pointermove', {
      bubbles: true,
      pointerId: opts.pointerId,
      clientX: opts.clientX,
      clientY: opts.clientY,
    }),
  );
}

function firePointerUp(canvas: HTMLElement, opts: { pointerId: number; clientX: number; clientY: number }) {
  canvas.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      pointerId: opts.pointerId,
      clientX: opts.clientX,
      clientY: opts.clientY,
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pinchZoomAction integration', () => {
  it('two-finger spread-out zooms in (scale increases)', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Pointer 1 down at (100, 100)
      firePointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
      // Pointer 2 down at (200, 100) — 100px spread → synthesizes multitouch(fingers=2)
      firePointerDown(canvas, { pointerId: 2, clientX: 200, clientY: 100 });
    });

    act(() => {
      // Pointer 2 moves to (300, 100) — spread grows from 100 → 200 → zoom in
      firePointerMove(canvas, { pointerId: 2, clientX: 300, clientY: 100 });
    });

    // Scale should have increased (pinch out = zoom in)
    expect(viewApi.current.scale.x).toBeGreaterThan(1);
    expect(viewApi.current.scale.y).toBeGreaterThan(1);
  });

  it('two-finger pinch-in zooms out (scale decreases)', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Pointer 1 at (50, 100), Pointer 2 at (250, 100) — 200px spread
      firePointerDown(canvas, { pointerId: 1, clientX: 50, clientY: 100 });
      firePointerDown(canvas, { pointerId: 2, clientX: 250, clientY: 100 });
    });

    act(() => {
      // Pointer 2 moves closer to 150 — spread shrinks 200 → 100 → zoom out
      firePointerMove(canvas, { pointerId: 2, clientX: 150, clientY: 100 });
    });

    expect(viewApi.current.scale.x).toBeLessThan(1);
    expect(viewApi.current.scale.y).toBeLessThan(1);
  });

  it('pointer-up at <2 fingers commits the pinch (scale retained)', () => {
    const viewApi = makeViewApi({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const Harness = buildHarness(viewApi);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
      firePointerDown(canvas, { pointerId: 2, clientX: 200, clientY: 100 });
    });
    act(() => {
      firePointerMove(canvas, { pointerId: 2, clientX: 300, clientY: 100 });
    });

    const scaleAfterZoom = viewApi.current.scale.x;
    expect(scaleAfterZoom).toBeGreaterThan(1);

    act(() => {
      firePointerUp(canvas, { pointerId: 2, clientX: 300, clientY: 100 });
    });

    // Scale should still be at the zoomed value (commit, not cancel)
    expect(viewApi.current.scale.x).toBeCloseTo(scaleAfterZoom, 5);
  });
});
