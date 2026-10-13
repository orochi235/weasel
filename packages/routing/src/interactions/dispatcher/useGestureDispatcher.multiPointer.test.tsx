import { describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';

function Probe({ actionDef, enabled = true, keyboard, affordanceAt, classifyTarget }: {
  actionDef: Action;
  enabled?: boolean;
  keyboard?: boolean;
  affordanceAt?: (p: { x: number; y: number }) => import('../actions/invoker').AffordanceHit | null;
  classifyTarget?: (p: { x: number; y: number }) => import('@weasel-js/gestures').BodyClassification;
}) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Always register (last-writer-wins is safe here)
  registry?.register(actionDef);
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    entriesById: new Map(),
    enabled,
    ...(keyboard !== undefined ? { keyboard } : {}),
    affordanceAt,
    classifyTarget,
  });
  return <canvas ref={canvasRef} />;
}

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

describe('multi-pointer policy', () => {
  function fire(el: Element, type: string, init: PointerEventInit = {}) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
  }

  function dragProbe(onStart: () => void) {
    const dragAction: Action = {
      id: 'demo.drag',
      label: 'drag',
      defaultBinding: { kind: 'drag' },
      invoker: {
        timing: 'ongoing',
        start: () => { onStart(); return { onMove: () => {}, onEnd: () => {} }; },
      },
    };
    return (
      <Harness>
        <Probe actionDef={dragAction} classifyTarget={() => ({ body: 'empty' })} />
      </Harness>
    );
  }

  it('a second finger does not open its own drag while a pinch is live', () => {
    // Two or more pointers down means the multitouch channel owns the
    // gesture. Before pointerId threading this held by accident (every
    // pointer aliased to one handle slot); now it's stated.
    const start = vi.fn();
    const { container } = render(dragProbe(start));
    const canvas = container.querySelector('canvas')!;
    act(() => {
      fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
      fire(canvas, 'pointerdown', { clientX: 100, clientY: 0, pointerId: 2 });
    });
    act(() => {
      fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1 });
      fire(canvas, 'pointermove', { clientX: 140, clientY: 40, pointerId: 2 });
    });
    expect(start).not.toHaveBeenCalled();
  });

  it('a drag already in flight survives a second finger landing', () => {
    // Yanking a gesture out from under the user because they rested a palm
    // is worse than letting it finish.
    const start = vi.fn();
    const { container } = render(dragProbe(start));
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1 }); });
    expect(start).toHaveBeenCalledTimes(1);
    act(() => { fire(canvas, 'pointerdown', { clientX: 100, clientY: 0, pointerId: 2 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 80, clientY: 40, pointerId: 1 }); });
    // Still exactly one drag — the second pointer opened nothing, and the
    // first one was not cancelled.
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('a claimed pointer synthesizes no click on release', () => {
    // Claiming drops the buffered press, and click synthesis reads that same
    // buffer — so the policy covers taps as well as drags. A finger that was
    // part of a pinch does not also click on the way up; the multitouch
    // channel's own `multitouchtap` is the tap for that gesture.
    const clickSpy = vi.fn();
    const clickAction: Action = {
      id: 'demo.click',
      label: 'click',
      defaultBinding: { kind: 'click' },
      invoker: { timing: 'immediate', run: () => clickSpy() },
    };
    const { container } = render(
      <Harness><Probe actionDef={clickAction} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;

    // Control: one pointer down + up is a click.
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 0, clientY: 0, pointerId: 1 }); });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Two pointers down: both are claimed, so neither release clicks.
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointerdown', { clientX: 100, clientY: 0, pointerId: 2 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 100, clientY: 0, pointerId: 2 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 0, clientY: 0, pointerId: 1 }); });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
