/**
 * Routing input to one of several views: which dispatcher an event runs on,
 * and which view's `clientToWorld` produced its coordinates.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/registry';
import { DepRegistryProvider, useDepSource } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher, type DispatcherViewTarget } from './useGestureDispatcher';
import { createDispatcher, type Dispatcher } from './dispatcher';
import { createViewResolver } from 'features/viewports/viewResolver';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../actions/depSchema';
import { viewportDragPanAction } from '../actions/defaults/viewportDragPan';
import type { InputEvent } from './matcher';

/** The panel occupies x ∈ [100, 200) of a canvas whose origin is (0, 0). */
const PANEL_RECT = { x: 100, y: 0, w: 100, h: 100 };
const FLAT: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function spyOn(d: Dispatcher): { d: Dispatcher; seen: InputEvent[] } {
  const seen: InputEvent[] = [];
  const real = d.handleInput.bind(d);
  vi.spyOn(d, 'handleInput').mockImplementation((ev, ctx) => {
    seen.push(ev);
    return real(ev, ctx);
  });
  return { d, seen };
}

function Probe({ root, panel }: { root: Dispatcher; panel: DispatcherViewTarget }) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const resolver = useRef<ReturnType<typeof createViewResolver> | null>(null);
  if (!resolver.current) {
    resolver.current = createViewResolver({
      views: () => [{ id: 'panel', view: FLAT, rect: PANEL_RECT }],
      root: () => FLAT,
      canvasOrigin: () => ({ left: 0, top: 0 }),
    });
  }
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    toolsById: new Map(),
    dispatcher: root,
    clientToWorld: (x, y) => ({ x, y }),
    views: { targets: () => [panel], resolver: resolver.current! },
  });
  return <canvas ref={canvasRef} />;
}

function mount() {
  const root = spyOn(createDispatcher());
  const panel = spyOn(createDispatcher());
  const target: DispatcherViewTarget = {
    id: 'panel',
    dispatcher: panel.d,
    affordanceAt: undefined,
    classifyTarget: undefined,
    // The panel's camera: client x 100 is the panel's world origin.
    clientToWorld: (x, y) => ({ x: x - PANEL_RECT.x, y }),
  };
  const { container } = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Probe root={root.d} panel={target} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return { root, panel, canvas: container.querySelector('canvas')! };
}

function fire(el: Element, type: string, init: PointerEventInit) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
}

const kinds = (evs: InputEvent[]): string[] => evs.map((e) => e.kind);

describe('useGestureDispatcher view routing', () => {
  it('runs an event on the dispatcher of the view it landed in', () => {
    const { root, panel, canvas } = mount();
    act(() => { fire(canvas, 'pointerdown', { clientX: 150, clientY: 10, pointerId: 1 }); });
    expect(kinds(panel.seen)).toContain('pointerdown');
    expect(root.seen).toHaveLength(0);
  });

  it('leaves points no view claims on the root dispatcher', () => {
    const { root, panel, canvas } = mount();
    act(() => { fire(canvas, 'pointerdown', { clientX: 50, clientY: 10, pointerId: 1 }); });
    expect(kinds(root.seen)).toContain('pointerdown');
    expect(panel.seen).toHaveLength(0);
  });

  it('reports coordinates through the routed view’s camera', () => {
    const { panel, canvas } = mount();
    act(() => { fire(canvas, 'pointerdown', { clientX: 150, clientY: 10, pointerId: 1 }); });
    const down = panel.seen.find((e) => e.kind === 'pointerdown')!;
    expect(down).toMatchObject({ x: 50, y: 10 });
  });

  it('keeps a drag on the view it began in after it leaves that view', () => {
    const { root, panel, canvas } = mount();
    act(() => {
      fire(canvas, 'pointerdown', { clientX: 150, clientY: 10, pointerId: 1 });
      fire(canvas, 'pointermove', { clientX: 50, clientY: 10, pointerId: 1 });
      fire(canvas, 'pointerup', { clientX: 50, clientY: 10, pointerId: 1 });
    });
    expect(root.seen).toHaveLength(0);
    // Still the panel's camera, 50px left of its origin.
    const move = panel.seen.find((e) => e.kind === 'pointermove')!;
    expect(move).toMatchObject({ x: -50, y: 10 });
  });

  it('releases the pin on pointerup, so the next gesture re-resolves', () => {
    const { root, panel, canvas } = mount();
    act(() => {
      fire(canvas, 'pointerdown', { clientX: 150, clientY: 10, pointerId: 1 });
      fire(canvas, 'pointerup', { clientX: 150, clientY: 10, pointerId: 1 });
    });
    panel.seen.length = 0;
    act(() => { fire(canvas, 'pointerdown', { clientX: 50, clientY: 10, pointerId: 1 }); });
    expect(kinds(root.seen)).toContain('pointerdown');
    expect(panel.seen).toHaveLength(0);
  });

  it('pans the view a drag began in, not the canvas', () => {
    const rootView = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const panelView = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const api = (hold: { current: View }): ViewApi => ({
      get: () => hold.current,
      set: (v) => { hold.current = v; },
    });
    const rootHold = { current: rootView };
    const panelHold = { current: panelView };

    function Panner() {
      const registry = useActionsRegistry();
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      registry?.register(viewportDragPanAction);
      useDepSource('view', () => api(rootHold));
      useGestureDispatcher({
        canvasRef,
        actions: registry!,
        toolsById: new Map(),
        clientToWorld: (x, y) => ({ x, y }),
        views: {
          targets: () => [{
            id: 'panel',
            dispatcher: panelDispatcher,
            affordanceAt: undefined,
            classifyTarget: undefined,
            clientToWorld: (x, y) => ({ x: x - PANEL_RECT.x, y }),
            deps: () => ({ view: api(panelHold) }),
          }],
          resolver: createViewResolver({
            views: () => [{ id: 'panel', view: FLAT, rect: PANEL_RECT }],
            root: () => FLAT,
            canvasOrigin: () => ({ left: 0, top: 0 }),
          }),
        },
      });
      return <canvas ref={canvasRef} />;
    }
    const panelDispatcher = createDispatcher();
    const { container } = render(
      <DepRegistryProvider>
        <ActiveToolContextProvider>
          <ActionsProvider><Panner /></ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => {
      fire(canvas, 'pointerdown', { clientX: 150, clientY: 10, pointerId: 1 });
      fire(canvas, 'pointermove', { clientX: 130, clientY: 10, pointerId: 1 });
      fire(canvas, 'pointerup', { clientX: 130, clientY: 10, pointerId: 1 });
    });
    expect(panelHold.current.x).toBe(20);
    expect(rootHold.current).toBe(rootView);
  });

  it('falls back to the root when the routed view is gone', () => {
    const root = spyOn(createDispatcher());
    function Gone() {
      const registry = useActionsRegistry();
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      useGestureDispatcher({
        canvasRef,
        actions: registry!,
        toolsById: new Map(),
        dispatcher: root.d,
        views: {
          // The resolver still names a view the target list no longer holds.
          targets: () => [],
          resolver: createViewResolver({
            views: () => [{ id: 'panel', view: FLAT, rect: PANEL_RECT }],
            root: () => FLAT,
            canvasOrigin: () => ({ left: 0, top: 0 }),
          }),
        },
      });
      return <canvas ref={canvasRef} />;
    }
    const { container } = render(
      <DepRegistryProvider>
        <ActiveToolContextProvider>
          <ActionsProvider><Gone /></ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 150, clientY: 10, pointerId: 1 }); });
    expect(kinds(root.seen)).toContain('pointerdown');
  });
});
