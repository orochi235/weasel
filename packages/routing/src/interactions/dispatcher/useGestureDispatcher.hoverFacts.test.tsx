/**
 * What the hover channel reports and shows when the pointer's view, its press, or its presence on the
 * canvas changed since the last hover: a leave names the view and spot the hover last saw, a gesture in
 * flight on any view shows its cursor, and nothing is shown for a pointer that has left.
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

const mount = () => mountWith(createDispatcher());

function mountWith(root: ReturnType<typeof createDispatcher>) {
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
      classifyTarget: (p) => ({ bodyTarget: p.x < 60 ? 'unselected-body' : 'empty' }),
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
  const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="c"]')!;
  const fire = (type: string, x: number, buttons = 0, on: Element = canvas): void => {
    act(() => {
      on.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons, clientX: x, clientY: 0 }));
    });
  };
  const hovers = () => seen.filter((s) => s.ev.kind === 'hover').map((s) => ({ on: s.on, ev: s.ev as Extract<InputEvent, { kind: 'hover' }> }));
  return { root, panel, canvas, fire, hovers };
}

describe('a hover leaving the surface', () => {
  it('tells the view the pointer last hovered in, though a wheel routed elsewhere since', () => {
    const { canvas, fire, hovers } = mount();
    fire('pointermove', 50);
    act(() => { canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 1, clientX: 150, clientY: 0 })); });
    fire('pointerleave', 150);
    const off = hovers().at(-1)!;
    expect(off.ev.off).toBe(true);
    expect(off.on).toBe('root');
  });

  it('names where the pointer is after a press no hover binding heard', () => {
    const { fire, hovers } = mount();
    fire('pointermove', 50);
    fire('pointerdown', 50, 1);
    fire('pointermove', 80, 1);
    fire('pointerleave', 80, 1);
    const off = hovers().at(-1)!.ev;
    expect(off.off).toBe(true);
    expect(off.clientX).toBe(80);
    expect(off.bodyTarget).toBe('empty');
  });

  it('gives the first hover after a release where the pointer came from, not where it was pressed', () => {
    const { fire, hovers } = mount();
    fire('pointermove', 50);
    fire('pointerdown', 50, 1);
    fire('pointermove', 80, 1);
    fire('pointerup', 80);
    fire('pointermove', 90);
    expect(hovers().at(-1)!.ev.from).toEqual({ bodyTarget: 'empty' });
  });
});

describe('the hover cursor', () => {
  it("shows a gesture in flight on another view's dispatcher", () => {
    const { root, canvas, fire } = mount();
    vi.spyOn(root, 'inFlight').mockReturnValue(new Map([['key:Space', {}]]) as never);
    vi.spyOn(root, 'inFlightCursor').mockReturnValue('grabbing');
    fire('pointermove', 150);
    expect(canvas.style.cursor).toBe('grabbing');
  });

  it("re-resolves when a gesture on another view's dispatcher ends", () => {
    let notify = (): void => {};
    const root = createDispatcher();
    const subscribe = root.subscribe.bind(root);
    vi.spyOn(root, 'subscribe').mockImplementation((fn) => { notify = fn; return subscribe(fn); });
    const { panel, canvas, fire } = mountWith(root);
    const flying = vi.spyOn(root, 'inFlight').mockReturnValue(new Map([['key:Space', {}]]) as never);
    vi.spyOn(root, 'inFlightCursor').mockReturnValue('grabbing');
    vi.spyOn(panel, 'resolveOnly').mockReturnValue({ action: { id: 'p', label: 'p', cursor: 'crosshair', invoker: { timing: 'immediate', run: () => {} } }, params: undefined } as never);
    fire('pointermove', 150);
    act(() => { notify(); });
    expect(canvas.style.cursor).toBe('grabbing');
    flying.mockReturnValue(new Map() as never);
    act(() => { notify(); vi.runAllTimers(); });
    expect(canvas.style.cursor).toBe('crosshair');
  });

  it('shows nothing for a held pointer that left before it moved or let go outside', () => {
    const { root, canvas, fire } = mount();
    vi.spyOn(root, 'inFlightCursor').mockReturnValue('grabbing');
    vi.spyOn(root, 'resolveOnly').mockReturnValue({ action: { id: 'p', label: 'p', cursor: 'grab', invoker: { timing: 'immediate', run: () => {} } }, params: undefined } as never);
    fire('pointermove', 50);
    expect(canvas.style.cursor).toBe('grab');
    fire('pointerdown', 50, 1);
    fire('pointerleave', 50, 1);
    expect(canvas.style.cursor).toBe('');
    fire('pointermove', -20, 1, document.body);
    expect(canvas.style.cursor).toBe('');
    fire('pointerup', -20, 0, document.body);
    act(() => { vi.runAllTimers(); });
    expect(canvas.style.cursor).toBe('');
  });
});
