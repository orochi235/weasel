/**
 * `requestRedraw` follows the dispatcher's own notifications: once for each
 * event that found or left a gesture in flight, however the event got there.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher, type DispatcherViewTarget } from './useGestureDispatcher';
import { createDispatcher, type Dispatcher } from './dispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useAction, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import type { Contribution } from '../../contributions/types';

beforeAll(() => {
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});

const drags: Contribution = {
  id: 'drags', eligibility: { always: true }, bindings: [{ spec: { kind: 'drag' }, actionId: 'drag' }],
};
const ENTRIES = new Map([[drags.id, drags]]);
const drag: Action = {
  id: 'drag', label: 'drag',
  invoker: { timing: 'ongoing', start: () => ({ kind: 'drag', onMove: () => {}, onEnd: () => {} }) },
};

function mount() {
  const redraw = vi.fn();
  const dispatcher = createDispatcher();
  function Mount({ enabled = true, on = dispatcher }: { enabled?: boolean; on?: Dispatcher }): ReactNode {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    useAction(drag);
    useGestureDispatcher({ canvasRef, actions: registry!, entriesById: ENTRIES, requestRedraw: redraw, dispatcher: on, enabled });
    return <canvas ref={canvasRef} data-testid="c" />;
  }
  const tree = (props: { enabled?: boolean; on?: Dispatcher }): ReactNode => (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Mount {...props} /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
  const { unmount, rerender } = render(tree({}));
  const canvas = document.querySelector('[data-testid="c"]')!;
  const fire = (on: EventTarget, type: string, x: number): void => {
    act(() => { on.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: 0 })); });
  };
  const update = (props: { enabled?: boolean; on?: Dispatcher }): void => { rerender(tree(props)); };
  return { redraw, dispatcher, canvas, fire, unmount, update };
}

describe('requestRedraw', () => {
  it('is not asked for by a move with nothing in flight', () => {
    const { redraw, canvas, fire } = mount();
    fire(canvas, 'pointermove', 10);
    fire(canvas, 'pointerdown', 10);
    expect(redraw).not.toHaveBeenCalled();
  });

  it('is asked for once by each event of a drag: its start, each move, and its release', () => {
    const { redraw, canvas, fire } = mount();
    fire(canvas, 'pointerdown', 0);
    // The move that crosses the threshold dispatches twice: the press that opens the drag, then itself.
    fire(document, 'pointermove', 40);
    expect(redraw).toHaveBeenCalledTimes(2);
    fire(document, 'pointermove', 50);
    expect(redraw).toHaveBeenCalledTimes(3);
    fire(document, 'pointerup', 50);
    expect(redraw).toHaveBeenCalledTimes(4);
  });

  it('is asked for when something other than an input event ends the gesture', () => {
    const { redraw, dispatcher, canvas, fire } = mount();
    fire(canvas, 'pointerdown', 0);
    fire(document, 'pointermove', 40);
    redraw.mockClear();
    act(() => { dispatcher.cancelAll('cancel'); });
    expect(redraw).toHaveBeenCalledTimes(1);
  });

  it('is asked for when turning the listeners off cancels a gesture, the canvas still mounted', () => {
    const { redraw, canvas, fire, update } = mount();
    fire(canvas, 'pointerdown', 0);
    fire(document, 'pointermove', 40);
    redraw.mockClear();
    update({ enabled: false });
    expect(redraw).toHaveBeenCalledTimes(1);
  });

  it('is asked for by a UI-driven step on a dispatcher swapped in, before any input reaches it', () => {
    const { redraw, update } = mount();
    const onEnd = vi.fn();
    const slide: Action = { id: 'slide', label: 'slide', invoker: { timing: 'ongoing', start: () => ({ onMove: () => {}, onEnd }) } };
    const next = createDispatcher({ getAction: (id) => (id === slide.id ? slide : undefined) });
    update({ on: next });
    redraw.mockClear();
    act(() => { next.beginUiOngoing('slide', {})?.update({}); });
    expect(redraw).toHaveBeenCalled();
  });

  it('is asked for by a UI-driven step on a view\'s dispatcher that appeared after the listeners attached', () => {
    const redraw = vi.fn();
    const slide: Action = { id: 'slide', label: 'slide', invoker: { timing: 'ongoing', start: () => ({ onMove: () => {}, onEnd: () => {} }) } };
    let targets: DispatcherViewTarget[] = [];
    const listeners = new Set<() => void>();
    const views = {
      targets: () => targets,
      resolver: { begin: () => ({ id: null }), at: () => ({ id: null }), end: () => {} },
      subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    };
    function Mount(): ReactNode {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const registry = useActionsRegistry();
      useGestureDispatcher({ canvasRef, actions: registry!, entriesById: ENTRIES, requestRedraw: redraw, views });
      return <canvas ref={canvasRef} />;
    }
    render(<DepRegistryProvider><ActiveToolContextProvider><ActionsProvider><Mount /></ActionsProvider></ActiveToolContextProvider></DepRegistryProvider>);
    const viewDispatcher = createDispatcher({ getAction: (id) => (id === slide.id ? slide : undefined) });
    targets = [{ id: 'side', dispatcher: viewDispatcher } as DispatcherViewTarget];
    for (const fn of listeners) fn();
    act(() => { viewDispatcher.beginUiOngoing('slide', {})?.update({}); });
    expect(redraw).toHaveBeenCalled();
  });

  it('is not asked for by the cancel that unmounting makes', () => {
    const { redraw, canvas, fire, unmount } = mount();
    fire(canvas, 'pointerdown', 0);
    fire(document, 'pointermove', 40);
    redraw.mockClear();
    unmount();
    expect(redraw).not.toHaveBeenCalled();
  });
});
