import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import {
  ActionsProvider,
  useActionsRegistry,
  type Action,
} from '../actions/registry';
import { DepRegistryProvider, useDepSource } from '../actions/depRegistry';
import { ActiveToolContextProvider, useActiveToolContext, type ActiveToolContextValue } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
import {
  makeToolOffhandAction,
  buildToolOffhandBindings,
} from '../actions/defaults/toolOffhand';

function Probe({ actionDef, enabled = true, affordanceAt, classifyTarget }: {
  actionDef: Action;
  enabled?: boolean;
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
    toolsById: new Map(),
    enabled,
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

describe('useGestureDispatcher', () => {
  it('window keydown matching defaultBinding fires the action invoker.run', () => {
    const spy = vi.fn();
    const action: Action = {
      id: 'demo.a',
      label: 'Demo A',
      defaultBinding: { kind: 'key', key: 'a' },
      invoker: { timing: 'immediate', run: () => spy() },
    };
    render(<Harness><Probe actionDef={action} /></Harness>);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('window keydown with no matching binding does NOT fire any action', () => {
    const spy = vi.fn();
    const action: Action = {
      id: 'demo.a',
      label: 'Demo A',
      defaultBinding: { kind: 'key', key: 'a' },
      invoker: { timing: 'immediate', run: () => spy() },
    };
    render(<Harness><Probe actionDef={action} /></Harness>);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' })); });
    expect(spy).not.toHaveBeenCalled();
  });

  it('keydown inside editable target is skipped', () => {
    const spy = vi.fn();
    const action: Action = {
      id: 'demo.a',
      label: 'Demo A',
      defaultBinding: { kind: 'key', key: 'a' },
      invoker: { timing: 'immediate', run: () => spy() },
    };
    render(<Harness><Probe actionDef={action} /></Harness>);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); });
    expect(spy).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('enabled: false opts out — keydown does not fire', () => {
    const spy = vi.fn();
    const action: Action = {
      id: 'demo.a',
      label: 'Demo A',
      defaultBinding: { kind: 'key', key: 'a' },
      invoker: { timing: 'immediate', run: () => spy() },
    };
    render(<Harness><Probe actionDef={action} enabled={false} /></Harness>);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); });
    expect(spy).not.toHaveBeenCalled();
  });

  it('unmount detaches listeners and cancels in-flight handles', () => {
    const endSpy = vi.fn();
    const action: Action = {
      id: 'demo.held',
      label: 'Demo held',
      defaultBinding: { kind: 'key-held', key: ' ' },
      invoker: { timing: 'ongoing', start: () => ({ onEnd: (_c, reason) => endSpy(reason) }) },
    };
    const { unmount } = render(<Harness><Probe actionDef={action} /></Harness>);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); });
    // Now unmount — should call onEnd('cancel') on the in-flight handle
    act(() => { unmount(); });
    expect(endSpy).toHaveBeenCalledWith('cancel');
    // And after unmount, new keydowns shouldn't fire anything (listener detached)
    const newSpy = vi.fn();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' })); });
    expect(newSpy).not.toHaveBeenCalled();
  });

  it('wheel event on canvas fires WheelSpec binding', () => {
    const spy = vi.fn();
    const action: Action = {
      id: 'demo.wheel',
      label: 'Demo wheel',
      defaultBinding: { kind: 'wheel', mods: { ctrl: true } },
      invoker: { timing: 'immediate', run: () => spy() },
    };
    const { container } = render(<Harness><Probe actionDef={action} /></Harness>);
    const canvas = container.querySelector('canvas')!;
    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, bubbles: true }));
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  describe('tool.offhand integration via gesture dispatcher', () => {
    it('Space keydown pushes hand to hotkeyStack; keyup pops it', () => {
      let ctxValue!: ActiveToolContextValue;

      function CtxCapture() {
        ctxValue = useActiveToolContext();
        return null;
      }

      function ActiveToolDepSource() {
        const ctx = useActiveToolContext();
        useDepSource('activeTool', () => ctx);
        return null;
      }

      function RegisterToolHold() {
        const r = useActionsRegistry();
        r?.register(makeToolOffhandAction(buildToolOffhandBindings([
          { toolId: 'hand', key: ' ' },
        ])));
        return null;
      }

      function MountDispatcher() {
        const ref = useRef<HTMLCanvasElement | null>(null);
        const r = useActionsRegistry();
        useGestureDispatcher({ canvasRef: ref, actions: r!, toolsById: new Map() });
        return <canvas ref={ref} />;
      }

      render(
        <DepRegistryProvider>
          <ActiveToolContextProvider>
              <ActionsProvider>
                <ActiveToolDepSource />
                <RegisterToolHold />
                <MountDispatcher />
                <CtxCapture />
              </ActionsProvider>
          </ActiveToolContextProvider>
        </DepRegistryProvider>,
      );

      // Initial state: no tools held
      expect(ctxValue.hotkeyStack).toEqual([]);

      // Press Space
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      });
      expect(ctxValue.hotkeyStack).toEqual(['hand']);

      // Release Space
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
      });
      expect(ctxValue.hotkeyStack).toEqual([]);
    });

    it('Space held across a window blur is released, not stuck', () => {
      let ctxValue!: ActiveToolContextValue;

      function CtxCapture() {
        ctxValue = useActiveToolContext();
        return null;
      }

      function ActiveToolDepSource() {
        const ctx = useActiveToolContext();
        useDepSource('activeTool', () => ctx);
        return null;
      }

      function RegisterToolHold() {
        const r = useActionsRegistry();
        r?.register(makeToolOffhandAction(buildToolOffhandBindings([
          { toolId: 'hand', key: ' ' },
        ])));
        return null;
      }

      function MountDispatcher() {
        const ref = useRef<HTMLCanvasElement | null>(null);
        const r = useActionsRegistry();
        useGestureDispatcher({ canvasRef: ref, actions: r!, toolsById: new Map() });
        return <canvas ref={ref} />;
      }

      render(
        <DepRegistryProvider>
          <ActiveToolContextProvider>
              <ActionsProvider>
                <ActiveToolDepSource />
                <RegisterToolHold />
                <MountDispatcher />
                <CtxCapture />
              </ActionsProvider>
          </ActiveToolContextProvider>
        </DepRegistryProvider>,
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      });
      expect(ctxValue.hotkeyStack).toEqual(['hand']);

      // The window loses focus mid-hold, so the keyup never arrives.
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      expect(ctxValue.hotkeyStack).toEqual([]);
    });
  });

  describe('hover-cursor pump', () => {
    /** Fires a synthetic PointerEvent on the canvas element. */
    function fire(el: Element, type: string, init: PointerEventInit = {}) {
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
    }

    const panAction: Action = {
      id: 'viewport.dragPan',
      label: 'pan',
      defaultBinding: { kind: 'drag' },
      cursor: 'grab',
      invoker: {
        timing: 'ongoing',
        start: () => ({ onMove: () => {}, onEnd: () => {} }),
      },
    };

    it('idle pointermove applies the predicted action cursor; pointerleave clears it', () => {
      const { container } = render(
        <Harness>
          <Probe actionDef={panAction} classifyTarget={() => ({ body: 'empty' })} />
        </Harness>,
      );
      const canvas = container.querySelector('canvas')!;
      act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40 }); });
      expect(canvas.style.cursor).toBe('grab');
      act(() => { fire(canvas, 'pointerleave'); });
      expect(canvas.style.cursor).toBe('');
    });

    it('affordance hit cursor wins over action prediction', () => {
      const { container } = render(
        <Harness>
          <Probe
            actionDef={panAction}
            classifyTarget={() => ({ body: 'empty' })}
            affordanceAt={() => ({ kind: 'handle:min-min', cursor: 'nwse-resize' })}
          />
        </Harness>,
      );
      const canvas = container.querySelector('canvas')!;
      act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40 }); });
      expect(canvas.style.cursor).toBe('nwse-resize');
    });

    it('swaps to the in-flight action cursor once the gesture starts', () => {
      const grabbing: Action = { ...panAction, activeCursor: 'grabbing' };
      const { container } = render(
        <Harness>
          <Probe actionDef={grabbing} classifyTarget={() => ({ body: 'empty' })} />
        </Harness>,
      );
      const canvas = container.querySelector('canvas')!;
      act(() => { fire(canvas, 'pointermove', { clientX: 0, clientY: 0 }); });
      expect(canvas.style.cursor).toBe('grab');
      // Press + drag past threshold: the pan handle opens.
      act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); });
      act(() => { fire(canvas, 'pointermove', { clientX: 30, clientY: 30, pointerId: 1 }); });
      expect(canvas.style.cursor).toBe('grabbing');
    });

    it('an in-flight action with no activeCursor holds its hover hint', () => {
      const { container } = render(
        <Harness>
          <Probe actionDef={panAction} classifyTarget={() => ({ body: 'empty' })} />
        </Harness>,
      );
      const canvas = container.querySelector('canvas')!;
      act(() => { fire(canvas, 'pointermove', { clientX: 0, clientY: 0 }); });
      act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); });
      act(() => { fire(canvas, 'pointermove', { clientX: 30, clientY: 30, pointerId: 1 }); });
      expect(canvas.style.cursor).toBe('grab');
    });

    it('leaves the cursor alone when the predicted action declares none', () => {
      const noCursorAction: Action = { ...panAction, id: 'no-cursor' };
      delete (noCursorAction as { cursor?: string }).cursor;
      const { container } = render(
        <Harness>
          <Probe actionDef={noCursorAction} classifyTarget={() => ({ body: 'empty' })} />
        </Harness>,
      );
      const canvas = container.querySelector('canvas')!;
      act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40 }); });
      expect(canvas.style.cursor).toBe('');
    });
  });

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
          canvasRef, actions: registry!, toolsById: new Map(), enabled: true,
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

    it('cancels the gesture when the canvas loses the pointer capture', () => {
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

      act(() => { fire(canvas, 'lostpointercapture', { pointerId: 1 }); });
      expect(endSpy).toHaveBeenCalledWith('cancel');
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
      const params = spy.mock.calls[0][0] as Record<string, number>;
      expect(params.pressX).toBe(10);
      expect(params.pressY).toBe(10);
      expect(params.worldX).toBe(12);
      expect(params.worldY).toBe(12);
    });
  });

  describe('tool-switch cancellation', () => {
    it('in-flight ongoing handles get onEnd("cancel") when active tool changes', () => {
      const endSpy = vi.fn();
      const action: Action = {
        id: 'demo.held',
        label: 'demo',
        defaultBinding: { kind: 'key-held', key: ' ' },
        invoker: {
          timing: 'ongoing',
          start: () => ({ onEnd: (_c, reason) => endSpy(reason) }),
        },
      };
      let ctxValue!: ActiveToolContextValue;
      function CtxCapture() { ctxValue = useActiveToolContext(); return null; }
      render(
        <Harness>
          <Probe actionDef={action} />
          <CtxCapture />
        </Harness>,
      );
      // Start an in-flight gesture
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); });
      expect(endSpy).not.toHaveBeenCalled();
      // Tool switch
      act(() => { ctxValue.setActive('rect'); });
      expect(endSpy).toHaveBeenCalledWith('cancel');
    });

    it('does NOT cancel on initial mount', () => {
      const startSpy = vi.fn();
      const endSpy = vi.fn();
      const action: Action = {
        id: 'demo.start',
        label: 'demo',
        defaultBinding: { kind: 'key-held', key: 'x' },
        invoker: {
          timing: 'ongoing',
          start: () => { startSpy(); return { onEnd: () => endSpy() }; },
        },
      };
      render(<Harness><Probe actionDef={action} /></Harness>);
      // Just mounting shouldn't fire start or end.
      expect(startSpy).not.toHaveBeenCalled();
      expect(endSpy).not.toHaveBeenCalled();
    });
  });

  describe('kind: target forms read the classifier’s node kind', () => {
    function fire(el: Element, type: string, init: PointerEventInit = {}) {
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
    }

    function clickOnce(container: HTMLElement) {
      const canvas = container.querySelector('canvas')!;
      act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }); });
      act(() => { fire(canvas, 'pointerup', { clientX: 10, clientY: 10, pointerId: 1 }); });
    }

    const clickAction = (spy: () => void, target: string): Action => ({
      id: 'demo.kinded',
      label: 'kinded',
      defaultBinding: { kind: 'click', target: target as 'empty' },
      invoker: { timing: 'immediate', run: () => spy() },
    });

    it('fires when the classifier reports the bound kind', () => {
      const spy = vi.fn();
      const { container } = render(
        <Harness>
          <Probe
            actionDef={clickAction(spy, 'kind:text')}
            classifyTarget={() => ({ body: 'unselected-body', kind: 'text' })}
          />
        </Harness>,
      );
      clickOnce(container);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not fire when the classifier reports a different kind', () => {
      const spy = vi.fn();
      const { container } = render(
        <Harness>
          <Probe
            actionDef={clickAction(spy, 'kind:text')}
            classifyTarget={() => ({ body: 'unselected-body', kind: 'rect' })}
          />
        </Harness>,
      );
      clickOnce(container);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not fire when the classifier names no kind', () => {
      const spy = vi.fn();
      const { container } = render(
        <Harness>
          <Probe
            actionDef={clickAction(spy, 'kind:text')}
            classifyTarget={() => ({ body: 'unselected-body' })}
          />
        </Harness>,
      );
      clickOnce(container);
      expect(spy).not.toHaveBeenCalled();
    });

    it('the :selected suffix additionally requires the body to be selected', () => {
      const spy = vi.fn();
      const { container } = render(
        <Harness>
          <Probe
            actionDef={clickAction(spy, 'kind:text:selected')}
            classifyTarget={() => ({ body: 'unselected-body', kind: 'text' })}
          />
        </Harness>,
      );
      clickOnce(container);
      expect(spy).not.toHaveBeenCalled();
    });

    it('fires for :selected when the body is in the selection', () => {
      const spy = vi.fn();
      const { container } = render(
        <Harness>
          <Probe
            actionDef={clickAction(spy, 'kind:text:selected')}
            classifyTarget={() => ({ body: 'selected-body', kind: 'text' })}
          />
        </Harness>,
      );
      clickOnce(container);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

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
});
