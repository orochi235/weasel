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
    /** Window key listeners a mount-then-unmount attaches and never removes. */
    const stranded = (enabled: boolean): number => {
      const add = vi.spyOn(window, 'addEventListener');
      const remove = vi.spyOn(window, 'removeEventListener');
      const { unmount } = render(<Harness><Probe actionDef={action} enabled={enabled} /></Harness>);
      if (enabled) act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); });
      act(() => { unmount(); });
      const left = add.mock.calls.filter(([type, listener]) =>
        (type === 'keydown' || type === 'keyup')
        && !remove.mock.calls.some(([t, l]) => t === type && l === listener));
      add.mockRestore();
      remove.mockRestore();
      return left.length;
    };
    stranded(false); // absorbs what the first mount in a realm installs for good
    // A proxy: a listener left behind is inert once the dispatcher is disposed, so only its removal shows.
    expect(stranded(true)).toBe(0);
    expect(endSpy).toHaveBeenCalledWith('cancel');
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

  it('hands a wheel counted in lines or pages over in pixels', () => {
    const seen: unknown[] = [];
    const action: Action = {
      id: 'demo.wheelDelta',
      label: 'Demo wheel delta',
      defaultBinding: { kind: 'wheel' },
      invoker: { timing: 'immediate', run: (_d, p) => { seen.push(p?.deltaY); } },
    };
    const { container } = render(<Harness><Probe actionDef={action} /></Harness>);
    const canvas = container.querySelector('canvas')!;
    act(() => {
      // Firefox reports a mouse wheel's notches as lines.
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, bubbles: true }));
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, deltaMode: 0, bubbles: true }));
    });
    expect(seen).toEqual([48, 3]);
  });
});
