import { describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useEffect, useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import { openPointerSession, type PointerSession } from '../pointerSession';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          {children}
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}

describe('useGestureDispatcher — controls inside the host', () => {
  function HostProbe() {
    const registry = useActionsRegistry();
    const hostRef = useRef<HTMLDivElement | null>(null);
    useGestureDispatcher({
      canvasRef: hostRef as unknown as React.RefObject<HTMLCanvasElement | null>,
      actions: registry!,
      entriesById: new Map(),
    });
    return (
      <div ref={hostRef} data-testid="host">
        <button type="button">control</button>
        <span>content</span>
      </div>
    );
  }

  // Proxy: jsdom's setPointerCapture changes nothing, so the click a browser
  // would retarget to the host cannot be observed here. What can be is whether
  // the dispatcher asked for capture at all — in a browser, asking is what
  // takes the click away from the button.
  it('leaves a press on a control to the control, and takes one on content', () => {
    const { getByTestId, getByText } = render(<Harness><HostProbe /></Harness>);
    const host = getByTestId('host');
    const capture = vi.fn();
    host.setPointerCapture = capture;
    act(() => {
      getByText('control').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
    });
    expect(capture).not.toHaveBeenCalled();
    act(() => {
      getByText('content').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, button: 0 }));
    });
    expect(capture).toHaveBeenCalledWith(2);
  });
});

function dragAction(start: () => void): Action {
  return {
    id: 'demo.drag',
    label: 'drag',
    defaultBinding: { kind: 'drag' },
    invoker: { timing: 'ongoing', start: () => { start(); return { onMove: () => {} }; } },
  };
}

function clickAction(run: () => void): Action {
  return { id: 'demo.click', label: 'click', defaultBinding: { kind: 'click' }, invoker: { timing: 'immediate', run } };
}

const press = (el: Element, type: string, x: number, pointerId = 1): void => {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, button: 0, buttons: 1, clientX: x, clientY: 0 }));
};

describe("useGestureDispatcher — controls: 'take'", () => {
  function TakeProbe({ actions, onItemDown }: {
    actions: Action[];
    onItemDown?: (e: React.PointerEvent<HTMLSpanElement>) => void;
  }) {
    const registry = useActionsRegistry();
    const hostRef = useRef<HTMLDivElement | null>(null);
    for (const a of actions) registry?.register(a);
    useGestureDispatcher({ canvasRef: hostRef, actions: registry!, entriesById: new Map(), controls: 'take' });
    return (
      <div ref={hostRef} data-testid="host">
        <button type="button">control</button>
        <span onPointerDown={onItemDown}>item</span>
      </div>
    );
  }

  it('drags from a control, capturing only once the press becomes a drag', () => {
    const start = vi.fn();
    const { getByTestId, getByText } = render(<Harness><TakeProbe actions={[dragAction(start)]} /></Harness>);
    const host = getByTestId('host');
    const capture = vi.fn();
    host.setPointerCapture = capture;
    const button = getByText('control');
    act(() => { press(button, 'pointerdown', 0); });
    expect(capture).not.toHaveBeenCalled();
    act(() => { press(button, 'pointermove', 2); });
    expect(capture).not.toHaveBeenCalled();
    act(() => { press(button, 'pointermove', 20); });
    expect(capture).toHaveBeenCalledWith(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('never captures a press on a control released in place, so the control keeps its click', () => {
    const { getByTestId, getByText } = render(<Harness><TakeProbe actions={[]} /></Harness>);
    const host = getByTestId('host');
    const capture = vi.fn();
    host.setPointerCapture = capture;
    const button = getByText('control');
    act(() => { press(button, 'pointerdown', 0); press(button, 'pointerup', 1); });
    expect(capture).not.toHaveBeenCalled();
  });

  it("yields to an item's own drag: neither its drag nor its click runs here", () => {
    const start = vi.fn();
    const click = vi.fn();
    let item: PointerSession | null = null;
    const { getByText } = render(
      <Harness>
        <TakeProbe
          actions={[dragAction(start), clickAction(click)]}
          onItemDown={(e) => { item = openPointerSession(e.currentTarget, e, {}); }}
        />
      </Harness>,
    );
    const span = getByText('item');
    act(() => { press(span, 'pointerdown', 0); press(span, 'pointermove', 20); press(span, 'pointerup', 20); });
    expect(start).not.toHaveBeenCalled();
    act(() => { press(span, 'pointerdown', 0, 2); press(span, 'pointerup', 0, 2); });
    expect(click).not.toHaveBeenCalled();
    expect(item).not.toBeNull();
  });

  it('yields to an item whose own press listener ran before the surface heard the press', () => {
    const click = vi.fn();
    function NativeItem() {
      const ref = useRef<HTMLSpanElement | null>(null);
      useEffect(() => {
        const el = ref.current!;
        const down = (e: PointerEvent): void => { openPointerSession(el, e, {}); };
        el.addEventListener('pointerdown', down);
        return () => { el.removeEventListener('pointerdown', down); };
      }, []);
      return <span ref={ref}>native</span>;
    }
    function NativeProbe() {
      const registry = useActionsRegistry();
      const hostRef = useRef<HTMLDivElement | null>(null);
      registry?.register(clickAction(click));
      useGestureDispatcher({ canvasRef: hostRef, actions: registry!, entriesById: new Map(), controls: 'take' });
      return <div ref={hostRef}><NativeItem /></div>;
    }
    const { getByText } = render(<Harness><NativeProbe /></Harness>);
    const span = getByText('native');
    act(() => { press(span, 'pointerdown', 0); press(span, 'pointerup', 0); });
    expect(click).not.toHaveBeenCalled();
  });
});
