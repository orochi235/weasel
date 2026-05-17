/**
 * Phase 14b — integration tests for lassoSelectAction via the gesture dispatcher.
 *
 * Proves:
 *   - pointerdown → match drag binding → start (lassoSelectAction)
 *   - pointermove×N → vertices accumulated in drag.points → onMove tracks
 *   - pointerup → onEnd('commit') → hitTestLasso called with polygon → setSelection
 *   - shift held → extends existing selection
 *   - pointercancel → onEnd('cancel') → no selection change
 *
 * ## Provider tree
 *
 *   DepRegistryProvider > ActiveToolContextProvider
 *     > ActionsProvider > [MountDispatcher + RegisterLassoSelectDep + RegisterLassoSelect]
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/registry';
import { DepRegistryProvider, useDepRegistry } from '../actions/depRegistry';
import '../actions/depSchema';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
import { lassoSelectAction } from '../actions/defaults/lassoSelect';
import type { LassoSelectDep } from '../actions/depSchema';

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

function makeLassoDepFactory(hits: string[] = [], initial: string[] = []) {
  let selection = initial.slice();
  const dep: LassoSelectDep & { calls: { hitTestLasso: unknown[]; setSelection: unknown[][] } } = {
    calls: { hitTestLasso: [], setSelection: [] },
    hitTestLasso(polygon, mode) {
      this.calls.hitTestLasso.push({ polygon: polygon.slice(), mode });
      return hits;
    },
    hitTestArea(_bounds) {
      return hits;
    },
    getSelection() { return selection; },
    setSelection(ids) {
      this.calls.setSelection.push(ids.slice());
      selection = ids;
    },
  };
  return dep;
}

function MountDispatcher({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const registry = useActionsRegistry();
  useGestureDispatcher({ canvasRef, actions: registry!, toolsById: new Map() });
  return <canvas ref={canvasRef} data-testid="canvas" />;
}

function RegisterLassoSelectDep({ dep }: { dep: LassoSelectDep }) {
  const registry = useDepRegistry();
  registry.register('lassoSelect', () => dep);
  return null;
}

function RegisterLassoSelect({ override }: { override?: boolean } = {}) {
  const registry = useActionsRegistry();
  if (registry && (override || !registry.list().find((a) => a.id === 'lassoSelect'))) {
    registry.register({ ...lassoSelectAction, enabled: () => true });
  }
  return null;
}

function buildHarness(dep: LassoSelectDep, shiftHeld = false) {
  function Harness() {
    const ref = useRef<HTMLCanvasElement | null>(null);
    return (
      <DepRegistryProvider>
        <ActiveToolContextProvider>
            <ActionsProvider>
              <RegisterLassoSelectDep dep={dep} />
              <RegisterLassoSelect />
              <MountDispatcher canvasRef={ref} />
            </ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>
    );
  }
  void shiftHeld;
  return Harness;
}

function firePointerDown(canvas: HTMLElement, opts: { clientX: number; clientY: number; shiftKey?: boolean }) {
  canvas.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: opts.clientX,
      clientY: opts.clientY,
      shiftKey: opts.shiftKey ?? false,
    }),
  );
}

function firePointerMove(canvas: HTMLElement, opts: { clientX: number; clientY: number; shiftKey?: boolean }) {
  canvas.dispatchEvent(
    new PointerEvent('pointermove', {
      bubbles: true,
      clientX: opts.clientX,
      clientY: opts.clientY,
      shiftKey: opts.shiftKey ?? false,
    }),
  );
}

function firePointerUp(canvas: HTMLElement, opts: { clientX: number; clientY: number; shiftKey?: boolean }) {
  canvas.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      clientX: opts.clientX,
      clientY: opts.clientY,
      shiftKey: opts.shiftKey ?? false,
    }),
  );
}

function firePointerCancel(canvas: HTMLElement) {
  canvas.dispatchEvent(
    new PointerEvent('pointercancel', { bubbles: true }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('lassoSelectAction integration', () => {
  it('drag → commit calls hitTestLasso and updates selection', () => {
    const dep = makeLassoDepFactory(['nodeA', 'nodeB']);
    const Harness = buildHarness(dep);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerDown(canvas, { clientX: 0, clientY: 0 });
    });
    act(() => {
      // Move enough to accumulate 3+ vertices (spacing > 2px each)
      firePointerMove(canvas, { clientX: 10, clientY: 0 });
      firePointerMove(canvas, { clientX: 10, clientY: 10 });
      firePointerMove(canvas, { clientX: 0, clientY: 10 });
    });
    act(() => {
      firePointerUp(canvas, { clientX: 0, clientY: 10 });
    });

    expect(dep.calls.hitTestLasso.length).toBe(1);
    expect(dep.calls.setSelection).toEqual([['nodeA', 'nodeB']]);
  });

  it('pointercancel → cancel → no selection change', () => {
    const dep = makeLassoDepFactory(['nodeA']);
    const Harness = buildHarness(dep);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerDown(canvas, { clientX: 0, clientY: 0 });
    });
    act(() => {
      firePointerMove(canvas, { clientX: 10, clientY: 0 });
      firePointerMove(canvas, { clientX: 10, clientY: 10 });
    });
    act(() => {
      firePointerCancel(canvas);
    });

    expect(dep.calls.setSelection).toEqual([]);
  });

  it('shift drag extends existing selection (merge without duplicates)', () => {
    const dep = makeLassoDepFactory(['nodeB'], ['nodeA']);
    const Harness = buildHarness(dep);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerDown(canvas, { clientX: 0, clientY: 0, shiftKey: true });
    });
    act(() => {
      firePointerMove(canvas, { clientX: 10, clientY: 0, shiftKey: true });
      firePointerMove(canvas, { clientX: 10, clientY: 10, shiftKey: true });
      firePointerMove(canvas, { clientX: 0, clientY: 10, shiftKey: true });
    });
    act(() => {
      firePointerUp(canvas, { clientX: 0, clientY: 10, shiftKey: true });
    });

    // nodeA (existing) + nodeB (hit) merged
    const lastSet = dep.calls.setSelection[dep.calls.setSelection.length - 1] as string[];
    expect(lastSet).toContain('nodeA');
    expect(lastSet).toContain('nodeB');
    expect(lastSet.length).toBe(2);
  });
});
