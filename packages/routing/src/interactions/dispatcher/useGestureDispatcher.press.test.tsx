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

describe('pointerDown bindings', () => {
  function fire(el: Element, type: string, init: PointerEventInit = {}) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
  }

  function pressAction(spy: (p?: Record<string, unknown>) => void): Action {
    return {
      id: 'demo.press',
      label: 'press',
      defaultBinding: { kind: 'pointerDown' },
      invoker: { timing: 'immediate', run: (_d, params) => spy(params) },
    };
  }

  it('fires while the button is still down, before any movement', () => {
    const spy = vi.fn();
    const { container } = render(
      <Harness><Probe actionDef={pressAction(spy)} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }); });
    // No pointerup yet — this is the whole point of the spec kind.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not fire for a second finger landing on the canvas', () => {
    // A pointer that is part of a pinch must not also act on its own: the
    // multitouch channel claims it, and `select.pick` changing the selection
    // under a two-finger gesture is what that failed to prevent.
    const spy = vi.fn();
    const { container } = render(
      <Harness><Probe actionDef={pressAction(spy)} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }); });
    expect(spy).toHaveBeenCalledTimes(1);
    act(() => { fire(canvas, 'pointerdown', { clientX: 90, clientY: 10, pointerId: 2 }); });
    expect(spy).toHaveBeenCalledTimes(1);
    act(() => { fire(canvas, 'pointerdown', { clientX: 50, clientY: 90, pointerId: 3 }); });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fires exactly once for a press that becomes a drag', () => {
    // The eager press dispatch and the buffered drag dispatch come from one
    // physical pointerdown. If the spec kinds overlapped, this would be 2.
    const pressSpy = vi.fn();
    const dragSpy = vi.fn();
    const dragAction: Action = {
      id: 'demo.drag',
      label: 'drag',
      defaultBinding: { kind: 'drag' },
      invoker: { timing: 'ongoing', start: () => { dragSpy(); return { onMove: () => {}, onEnd: () => {} }; } },
    };
    function TwoActions() {
      const registry = useActionsRegistry();
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      registry?.register(pressAction(pressSpy));
      registry?.register(dragAction);
      useGestureDispatcher({
        canvasRef, actions: registry!, entriesById: new Map(), enabled: true,
        classifyTarget: () => ({ body: 'empty' as const }),
      });
      return <canvas ref={canvasRef} />;
    }
    const { container } = render(<Harness><TwoActions /></Harness>);
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40, pointerId: 1 }); });
    expect(pressSpy).toHaveBeenCalledTimes(1);
    expect(dragSpy).toHaveBeenCalledTimes(1);
  });

  it('refuses an ongoing invoker rather than colliding with the drag handle', () => {
    const startSpy = vi.fn();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad: Action = {
      id: 'demo.badPress',
      label: 'bad',
      defaultBinding: { kind: 'pointerDown' },
      invoker: { timing: 'ongoing', start: () => { startSpy(); return { onEnd: () => {} }; } },
    };
    const { container } = render(
      <Harness><Probe actionDef={bad} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); });
    expect(startSpy).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith(expect.stringContaining('pointerDown spec'));
    err.mockRestore();
  });

  it('no click is synthesized once the pointer passes the drag threshold', () => {
    // Even with nothing bound to `drag`. "No drag handle opened" used to be
    // the only condition, so a tool that binds click but not drag saw a
    // full-canvas drag arrive as a click.
    const spy = vi.fn();
    const clickAction: Action = {
      id: 'demo.click',
      label: 'click',
      defaultBinding: { kind: 'click' },
      invoker: { timing: 'immediate', run: () => spy() },
    };
    const { container } = render(
      <Harness><Probe actionDef={clickAction} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 90, clientY: 90, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 90, clientY: 90, pointerId: 1 }); });
    expect(spy).not.toHaveBeenCalled();
  });

  it('a synthesized click carries the press point alongside the release point', () => {
    const spy = vi.fn();
    const clickAction: Action = {
      id: 'demo.click',
      label: 'click',
      defaultBinding: { kind: 'click' },
      invoker: { timing: 'immediate', run: (_d, params) => spy(params) },
    };
    const { container } = render(
      <Harness><Probe actionDef={clickAction} classifyTarget={() => ({ body: 'empty' })} /></Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    // Press and release 2px apart — under the 4px drag threshold, so this
    // is still a click, but press and release coords differ.
    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 12, clientY: 12, pointerId: 1 }); });
    expect(spy).toHaveBeenCalledTimes(1);
    const params = spy.mock.calls[0][0] as Record<string, unknown>;
    expect(params.press).toEqual({ x: 10, y: 10 });
    expect(params.world).toEqual({ x: 12, y: 12 });
  });
});
