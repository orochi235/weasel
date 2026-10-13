/**
 * A long-press fires from a timer, after other input may have routed to
 * another view. It still belongs to the view its press went down in.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher, type DispatcherViewTarget } from './useGestureDispatcher';
import { createDispatcher, type DispatcherContext } from './dispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { InputEvent } from './matcher';

beforeAll(() => {
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

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

function mount(): { canvas: Element; held: () => { on: string; kind: string; viewId: string | null | undefined }[] } {
  const root = createDispatcher();
  const panel = createDispatcher();
  const seen: { on: string; ev: InputEvent; ctx: DispatcherContext }[] = [];
  for (const [on, d] of [['root', root], ['panel', panel]] as const) {
    vi.spyOn(d, 'handleInput').mockImplementation((ev, ctx) => {
      seen.push({ on, ev, ctx });
      return 'unhandled';
    });
  }
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
  return {
    canvas,
    held: () => seen
      .filter((s) => s.ev.kind === 'longpress' || s.ev.kind === 'contextmenu')
      .map((s) => ({ on: s.on, kind: s.ev.kind, viewId: s.ctx.viewId })),
  };
}

/** A touch goes down in the panel, then a mouse moves over the root view. */
function pressInPanelThenHoverRoot(canvas: Element): void {
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 1, pointerType: 'touch', button: 0, buttons: 1, clientX: 150, clientY: 10,
    }));
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerId: 2, pointerType: 'mouse', clientX: 50, clientY: 10,
    }));
  });
}

const IN_PANEL = [
  { on: 'panel', kind: 'longpress', viewId: 'panel' },
  { on: 'panel', kind: 'contextmenu', viewId: 'panel' },
];

describe('a long-press that fires after another pointer moved in a different view', () => {
  it('dispatches on the view the press went down in when its timer fires', () => {
    const { canvas, held } = mount();
    pressInPanelThenHoverRoot(canvas);
    act(() => { vi.advanceTimersByTime(500); });
    expect(held()).toEqual(IN_PANEL);
  });

  it('dispatches on that view when the platform reports the hold as a contextmenu first', () => {
    const { canvas, held } = mount();
    pressInPanelThenHoverRoot(canvas);
    act(() => {
      canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 150, clientY: 10 }));
    });
    expect(held()).toEqual(IN_PANEL);
  });
});
