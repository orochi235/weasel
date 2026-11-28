/**
 * A pinch whose fingers land in different views runs on the one view it opened in, whichever finger moves.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher, type DispatcherViewTarget } from './useGestureDispatcher';
import { createDispatcher, multiTouchGestureId, type DispatcherContext } from './dispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { InputEvent } from './matcher';

beforeAll(() => {
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});

/** The panel is every point at client x >= 100. A held pointer stays in the view it began in. */
function pinningResolver() {
  const pinned = new Map<number, string | null>();
  const viewAt = (x: number): string | null => (x >= 100 ? 'panel' : null);
  return {
    begin: (pointerId: number, x: number) => {
      pinned.set(pointerId, viewAt(x));
      return { id: viewAt(x) };
    },
    at: (pointerId: number | null, x: number) =>
      ({ id: pointerId !== null && pinned.has(pointerId) ? pinned.get(pointerId)! : viewAt(x) }),
    end: (pointerId: number): void => { pinned.delete(pointerId); },
  };
}

function mount() {
  const root = createDispatcher();
  const panel = createDispatcher();
  const seen: { on: string; ev: InputEvent; ctx: DispatcherContext }[] = [];
  const pinches = new Set<string>();
  for (const [on, d] of [['root', root], ['panel', panel]] as const) {
    vi.spyOn(d, 'handleInput').mockImplementation((ev, ctx) => {
      seen.push({ on, ev, ctx });
      if (on === 'panel' && ev.kind === 'multitouch') {
        if ('end' in ev && ev.end) pinches.delete(multiTouchGestureId(ev.fingers));
        else pinches.add(multiTouchGestureId(ev.fingers));
      }
      return 'unhandled';
    });
  }
  vi.spyOn(panel, 'inFlight').mockImplementation(() => new Set(pinches) as never);
  const target: DispatcherViewTarget = {
    id: 'panel', dispatcher: panel,
    affordanceAt: undefined, classifyTarget: undefined, clientToWorld: undefined,
  };
  const resolver = pinningResolver();
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
  const fire = (type: string, pointerId: number, x: number): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: 0,
      }));
    });
  };
  const pinchEvents = () => seen.filter((s) => s.ev.kind === 'multitouch')
    .map((s) => ({ on: s.on, viewId: s.ctx.viewId, end: 'end' in s.ev ? s.ev.end : undefined }));
  return { fire, pinchEvents };
}

describe('a pinch whose fingers land in different views', () => {
  it("runs the first finger's moves on the view the pinch opened in", () => {
    const { fire, pinchEvents } = mount();
    fire('pointerdown', 1, 50);
    fire('pointerdown', 2, 150);
    expect(pinchEvents()).toEqual([{ on: 'panel', viewId: 'panel', end: undefined }]);
    fire('pointermove', 1, 40);
    expect(pinchEvents()).toEqual([
      { on: 'panel', viewId: 'panel', end: undefined },
      { on: 'panel', viewId: 'panel', end: undefined },
    ]);
  });

  it('ends on that view when the first finger lifts', () => {
    const { fire, pinchEvents } = mount();
    fire('pointerdown', 1, 50);
    fire('pointerdown', 2, 150);
    fire('pointerup', 1, 50);
    expect(pinchEvents().at(-1)).toEqual({ on: 'panel', viewId: 'panel', end: 'commit' });
  });
});
