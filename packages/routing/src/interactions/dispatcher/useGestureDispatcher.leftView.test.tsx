/** A gesture on a view that has since left the surface still repaints when it ends. */
import { expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher, type DispatcherViewTarget } from './useGestureDispatcher';
import { createDispatcher } from './dispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useAction, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';

const viewAt = (_pointerId: number | null, x: number): { id: string | null } => ({ id: x >= 100 ? 'panel' : null });

it('redraws when a held key ends its gesture on a view no longer among the targets', () => {
  const hold: Action = {
    id: 'test.hold', label: 'hold', defaultBinding: { kind: 'keyHeld', key: 'h' },
    invoker: { timing: 'ongoing', start: () => ({ onEnd: () => {} }) },
  };
  const panel = createDispatcher();
  const target: DispatcherViewTarget = {
    id: 'panel', dispatcher: panel, affordanceAt: undefined, classifyTarget: undefined, clientToWorld: undefined,
  };
  let targets: DispatcherViewTarget[] = [target];
  const listeners = new Set<() => void>();
  const subscribe = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
  const requestRedraw = vi.fn();
  function Mount(): ReactNode {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    useAction(hold);
    useGestureDispatcher({
      canvasRef, actions: registry!, entriesById: new Map(), dispatcher: createDispatcher(), requestRedraw,
      views: { targets: () => targets, resolver: { at: viewAt, begin: viewAt, end: () => {} }, subscribe },
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
  act(() => { canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 150, clientY: 10 })); });
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', code: 'KeyH' })); });
  expect(panel.inFlight().size).toBe(1);
  act(() => { targets = []; for (const fn of listeners) fn(); });
  requestRedraw.mockClear();
  act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { key: 'h', code: 'KeyH' })); });
  expect(panel.inFlight().size).toBe(0);
  expect(requestRedraw).toHaveBeenCalled();
});
