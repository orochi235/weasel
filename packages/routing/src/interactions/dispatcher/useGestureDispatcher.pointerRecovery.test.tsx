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

describe('a held pointer whose release goes missing', () => {
  function fire(el: Element, type: string, init: PointerEventInit = {}) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
  }

  it('ends a drag whose release the canvas never saw', () => {
    // The pointerup landed somewhere this document could not see — another
    // window, a native drag. The next move arrives with nothing held, and
    // that is the release. Without reading it the drag hangs in flight.
    const endSpy = vi.fn();
    const dragAction: Action = {
      id: 'demo.drag',
      label: 'drag',
      defaultBinding: { kind: 'drag' },
      invoker: {
        timing: 'ongoing',
        start: () => ({ onMove: () => {}, onEnd: (_c, reason) => endSpy(reason) }),
      },
    };
    const { container } = render(
      <Harness><Probe actionDef={dragAction} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1, buttons: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1, buttons: 1 }); });
    expect(endSpy).not.toHaveBeenCalled();

    act(() => { fire(canvas, 'pointermove', { clientX: 50, clientY: 50, pointerId: 1, buttons: 0 }); });
    expect(endSpy).toHaveBeenCalledTimes(1);
  });

  it('cancels a stale drag when a fresh press arrives on the same pointer', () => {
    // The release landed on another window and the pointer never came back
    // over the canvas, so the missed-release rule never saw it. The next
    // press is the proof it ended; without this the stale drag steers with
    // the new press. It cancels rather than commits because where the
    // pointer actually came up is unknown — the new press's coordinates are
    // not it.
    const endSpy = vi.fn();
    const moveSpy = vi.fn();
    const dragAction: Action = {
      id: 'demo.drag',
      label: 'drag',
      defaultBinding: { kind: 'drag' },
      invoker: {
        timing: 'ongoing',
        start: () => ({ onMove: () => moveSpy(), onEnd: (_c, reason) => endSpy(reason) }),
      },
    };
    const { container } = render(
      <Harness><Probe actionDef={dragAction} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1, buttons: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1, buttons: 1 }); });
    expect(endSpy).not.toHaveBeenCalled();

    act(() => { fire(canvas, 'pointerdown', { clientX: 5, clientY: 5, pointerId: 1, buttons: 1 }); });
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledWith('cancel');
  });

  it('ends a drag released outside the canvas', () => {
    // The gesture is the pointer's, not the element's: a release anywhere
    // in the document ends it, whether or not capture retargeted it back.
    const endSpy = vi.fn();
    const dragAction: Action = {
      id: 'demo.drag',
      label: 'drag',
      defaultBinding: { kind: 'drag' },
      invoker: {
        timing: 'ongoing',
        start: () => ({ onMove: () => {}, onEnd: (_c, reason) => endSpy(reason) }),
      },
    };
    const { container } = render(
      <Harness><Probe actionDef={dragAction} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1, buttons: 1 }); });
    act(() => { fire(document.body, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1, buttons: 1 }); });
    expect(endSpy).not.toHaveBeenCalled();

    act(() => { fire(document.body, 'pointerup', { clientX: 40, clientY: 40, pointerId: 1 }); });
    expect(endSpy).toHaveBeenCalledWith('commit');
  });

  it('leaves the drag alone when the source never reports buttons', () => {
    // A press carrying no button state means the source does not report it,
    // and every move would otherwise read as a release.
    const endSpy = vi.fn();
    const moveSpy = vi.fn();
    const dragAction: Action = {
      id: 'demo.drag',
      label: 'drag',
      defaultBinding: { kind: 'drag' },
      invoker: {
        timing: 'ongoing',
        start: () => ({ onMove: () => moveSpy(), onEnd: () => endSpy() }),
      },
    };
    const { container } = render(
      <Harness><Probe actionDef={dragAction} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 50, clientY: 50, pointerId: 1 }); });
    expect(endSpy).not.toHaveBeenCalled();
    expect(moveSpy).toHaveBeenCalled();
  });

  it('keeps the gesture when capture is lost but the canvas is still there', () => {
    const endSpy = vi.fn();
    const dragAction: Action = {
      id: 'demo.drag',
      label: 'drag',
      defaultBinding: { kind: 'drag' },
      invoker: {
        timing: 'ongoing',
        start: () => ({ onMove: () => {}, onEnd: (_c, reason) => endSpy(reason) }),
      },
    };
    const { container } = render(
      <Harness><Probe actionDef={dragAction} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1, buttons: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1, buttons: 1 }); });
    expect(endSpy).not.toHaveBeenCalled();

    // Chrome releases capture implicitly a beat before pointerup. Ending
    // here threw the release away; the session reads the document and never
    // needed capture to hear it.
    act(() => { fire(canvas, 'lostpointercapture', { pointerId: 1 }); });
    expect(endSpy).not.toHaveBeenCalled();

    act(() => { fire(canvas, 'pointerup', { clientX: 40, clientY: 40, pointerId: 1 }); });
    expect(endSpy).toHaveBeenCalledWith('commit');
  });

  it('a released pointer losing capture reports nothing twice', () => {
    // A real release fires pointerup and then lostpointercapture. The
    // gesture is already over; the second must not re-report it.
    const endSpy = vi.fn();
    const dragAction: Action = {
      id: 'demo.drag',
      label: 'drag',
      defaultBinding: { kind: 'drag' },
      invoker: {
        timing: 'ongoing',
        start: () => ({ onMove: () => {}, onEnd: (_c, reason) => endSpy(reason) }),
      },
    };
    const { container } = render(
      <Harness><Probe actionDef={dragAction} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1, buttons: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1, buttons: 1 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 40, clientY: 40, pointerId: 1 }); });
    act(() => { fire(canvas, 'lostpointercapture', { pointerId: 1 }); });
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).not.toHaveBeenCalledWith('cancel');
  });

  describe('window blur', () => {
    const dragProbe = (keyboard?: boolean) => {
      const endSpy = vi.fn();
      const startSpy = vi.fn();
      const dragAction: Action = {
        id: 'demo.drag',
        label: 'drag',
        defaultBinding: { kind: 'drag' },
        invoker: {
          timing: 'ongoing',
          start: () => {
            startSpy();
            return { onMove: () => {}, onEnd: (_c, reason) => endSpy(reason) };
          },
        },
      };
      const { container } = render(
        <Harness>
          <Probe
            actionDef={dragAction}
            classifyTarget={() => ({ body: 'empty' })}
            {...(keyboard !== undefined ? { keyboard } : {})}
          />
        </Harness>,
      );
      return { canvas: container.querySelector('canvas')!, endSpy, startSpy };
    };

    it('cancels a drag in flight', () => {
      const { canvas, endSpy } = dragProbe();
      act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1, buttons: 1 }); });
      act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1, buttons: 1 }); });
      expect(endSpy).not.toHaveBeenCalled();

      act(() => { window.dispatchEvent(new Event('blur')); });
      expect(endSpy).toHaveBeenCalledTimes(1);
      expect(endSpy).toHaveBeenCalledWith('cancel');

      // The release the window eventually delivers belongs to a gesture
      // that is already over.
      act(() => { fire(canvas, 'pointerup', { clientX: 40, clientY: 40, pointerId: 1 }); });
      expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('cancels a drag even when keyboard dispatch is off', () => {
      const { canvas, endSpy } = dragProbe(false);
      act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1, buttons: 1 }); });
      act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1, buttons: 1 }); });
      act(() => { window.dispatchEvent(new Event('blur')); });
      expect(endSpy).toHaveBeenCalledWith('cancel');
    });

    it('drops a press that had not yet become a drag', () => {
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
      act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1, buttons: 1 }); });
      act(() => { window.dispatchEvent(new Event('blur')); });
      act(() => { fire(canvas, 'pointerup', { clientX: 10, clientY: 10, pointerId: 1 }); });
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('does nothing with no pointer held', () => {
      const { canvas, endSpy, startSpy } = dragProbe();
      act(() => { window.dispatchEvent(new Event('blur')); });
      expect(startSpy).not.toHaveBeenCalled();
      expect(endSpy).not.toHaveBeenCalled();

      // And the canvas still takes the next drag.
      act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1, buttons: 1 }); });
      act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1, buttons: 1 }); });
      act(() => { fire(canvas, 'pointerup', { clientX: 40, clientY: 40, pointerId: 1 }); });
      expect(endSpy).toHaveBeenCalledWith('commit');
    });
  });

});
