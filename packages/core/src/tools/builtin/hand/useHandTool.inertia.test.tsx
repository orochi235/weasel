/**
 * The hand tool's options, through the real dispatcher. Unit tests on
 * `viewportDragPanAction` call `start(ctx, opts)` by hand, so they stay green
 * even if the dispatcher never forwards a binding's `opts` — which is exactly
 * the path `axis` and `inertia` travel.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry, useAction } from 'interactions/actions/registry';
import { DepRegistryProvider, useDepSource } from 'interactions/actions/depRegistry';
import 'interactions/actions/depSchema';
import { ActiveToolContextProvider } from 'interactions/actions/activeToolContext';
import { useGestureDispatcher } from 'interactions/dispatcher/useGestureDispatcher';
import { viewportDragPanAction } from 'interactions/actions/defaults/viewportDragPan';
import { useTools } from '../../useTools';
import { useHandTool } from './useHandTool';
import type { View } from 'core/viewport/view';
import type { ViewApi } from 'interactions/actions/depSchema';
import type { DecayLoopConfig } from 'core/viewport/useDecayLoop';
import type { UseHandToolOptions } from './useHandTool';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function drag(el: HTMLElement, path: Array<[number, number]>) {
  const opts = { pointerId: 1, bubbles: true, isPrimary: true, button: 0 };
  const [x0, y0] = path[0];
  act(() => {
    el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: x0, clientY: y0 }));
  });
  for (const [x, y] of path.slice(1)) {
    act(() => {
      el.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: x, clientY: y }));
    });
  }
  const [xn, yn] = path[path.length - 1];
  act(() => {
    el.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: xn, clientY: yn }));
  });
}

/** Mounts the real hand tool + dispatcher over a view dep we can inspect. */
function mount(handOpts: UseHandToolOptions, decay?: (c: DecayLoopConfig) => void) {
  const state: { view: View } = { view: { x: 0, y: 0, scale: { x: 1, y: 1 } } };

  function ViewDep() {
    const api: ViewApi = {
      get: () => state.view,
      set: (v) => { state.view = v; },
      ...(decay ? { decay, stopDecay: () => {} } : {}),
    };
    useDepSource('view', () => api);
    return null;
  }

  function Mount() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    useAction(viewportDragPanAction);
    const hand = useHandTool(handOpts);
    const tools = useTools({ active: 'hand', registry: { hand } });
    useGestureDispatcher({
      canvasRef,
      actions: registry!,
      toolsById: new Map(Object.entries(tools.registry)),
    });
    return <canvas ref={canvasRef} data-testid="c" />;
  }

  const utils = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <ViewDep />
          <Mount />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return { state, canvas: utils.getByTestId('c') };
}

describe('useHandTool options reach viewport.dragPan through the dispatcher', () => {
  it('pans both axes by default', () => {
    const { state, canvas } = mount({});
    drag(canvas, [[0, 0], [40, 25]]);
    expect(state.view.x).toBe(-40);
    expect(state.view.y).toBe(-25);
  });

  it("axis 'x' leaves y alone", () => {
    const { state, canvas } = mount({ axis: 'x' });
    drag(canvas, [[0, 0], [40, 25]]);
    expect(state.view.x).toBe(-40);
    expect(state.view.y).toBe(0);
  });

  it("axis 'y' leaves x alone", () => {
    const { state, canvas } = mount({ axis: 'y' });
    drag(canvas, [[0, 0], [40, 25]]);
    expect(state.view.x).toBe(0);
    expect(state.view.y).toBe(-25);
  });

  it('starts a coast on release when inertia is configured', () => {
    const calls: DecayLoopConfig[] = [];
    const { canvas } = mount({ inertia: { friction: 0.8 } }, (c) => calls.push(c));
    drag(canvas, [[0, 0], [10, 10], [25, 25], [45, 45]]);
    expect(calls).toHaveLength(1);
    expect(calls[0].friction).toBe(0.8);
  });

  it('starts no coast when inertia is not asked for', () => {
    const calls: DecayLoopConfig[] = [];
    const { canvas } = mount({}, (c) => calls.push(c));
    drag(canvas, [[0, 0], [10, 10], [45, 45]]);
    expect(calls).toHaveLength(0);
  });
});
