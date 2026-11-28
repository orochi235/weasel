/**
 * Which view a wheel or a WebKit pinch runs on, and the point it carries: the view-local point its camera
 * anchors in, the view a pinch began over for every step, and the view a held pointer's drag runs in.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher, type DispatcherViewTarget } from './useGestureDispatcher';
import { createDispatcher, pointerGestureId } from './dispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { InputEvent } from './matcher';

afterEach(cleanup);

/** The panel is every point at client x >= 100, and its own pixels start there. */
const viewAt = (x: number): string | null => (x >= 100 ? 'panel' : null);
const resolver = {
  begin: (_pointerId: number, x: number) => ({ id: viewAt(x) }),
  at: (_pointerId: number | null, x: number) => ({ id: viewAt(x) }),
  end: (): void => {},
};

function mount(rootHolds: string[] = []) {
  const root = createDispatcher();
  const panel = createDispatcher();
  const seen: { on: string; ev: InputEvent }[] = [];
  for (const [on, d] of [['root', root], ['panel', panel]] as const) {
    vi.spyOn(d, 'handleInput').mockImplementation((ev) => {
      seen.push({ on, ev });
      return 'unhandled';
    });
  }
  vi.spyOn(root, 'inFlight').mockImplementation(() => new Map(rootHolds.map((id) => [id, {}])) as never);
  const target: DispatcherViewTarget = {
    id: 'panel', dispatcher: panel,
    affordanceAt: undefined, classifyTarget: undefined, clientToWorld: undefined,
    clientToLocal: (cx, cy) => ({ x: cx - 100, y: cy }),
  };
  function Mount(): ReactNode {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    useGestureDispatcher({
      canvasRef, actions: registry!, entriesById: new Map(), dispatcher: root,
      views: { targets: () => [target], resolver },
    });
    return <canvas ref={canvasRef} data-testid="c" />;
  }
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Mount /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const canvas = document.querySelector('[data-testid="c"]')!;
  const fire = (e: Event): void => { act(() => { canvas.dispatchEvent(e); }); };
  const wheel = (x: number): void => fire(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -10, clientX: x, clientY: 5 }));
  const gesture = (type: string, x: number, scale: number): void =>
    fire(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { scale, rotation: 0, clientX: x, clientY: 5 }));
  const of = (kind: InputEvent['kind']) => seen.filter((s) => s.ev.kind === kind);
  return { wheel, gesture, of };
}

describe('a wheel and a WebKit pinch over a view', () => {
  it("carry the point in the view's own pixels, where its camera anchors", () => {
    const { wheel, gesture, of } = mount();
    wheel(150);
    gesture('gesturestart', 150, 1);
    gesture('gesturechange', 150, 1.5);
    expect(of('wheel').map((s) => [s.on, (s.ev as { clientX: number }).clientX])).toEqual([['panel', 50]]);
    expect(of('pinch').map((s) => [s.on, (s.ev as { clientX: number }).clientX])).toEqual([['panel', 50]]);
  });

  it('runs every step of a pinch on the view it began over, wherever its focal point drifts', () => {
    const { gesture, of } = mount();
    gesture('gesturestart', 50, 1);
    gesture('gesturechange', 150, 1.2);
    gesture('gesturechange', 160, 1.4);
    gesture('gestureend', 160, 1.4);
    gesture('gesturestart', 150, 1);
    gesture('gesturechange', 150, 1.2);
    expect(of('pinch').map((s) => s.on)).toEqual(['root', 'root', 'panel']);
  });

  it('goes to the view a held pointer is dragging in, not the one under it', () => {
    const { wheel, of } = mount([pointerGestureId(1)]);
    wheel(150);
    expect(of('wheel').map((s) => s.on)).toEqual(['root']);
  });
});
