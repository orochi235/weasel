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
import { makeToolHoldAction } from '../actions/defaults/toolHold';

function Probe({ actionDef, enabled = true }: { actionDef: Action; enabled?: boolean }) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Always register (last-writer-wins is safe here)
  registry?.register(actionDef);
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    toolsById: new Map(),
    enabled,
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

  describe('tool.hold integration via gesture dispatcher', () => {
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
        r?.register(makeToolHoldAction('hand', ' '));
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
});
