/** The `dispatcher` option is followed when it changes, not read once at mount. */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { createDispatcher } from './dispatcher';
import type { Dispatcher } from './dispatcherApi';
import { useGestureDispatcher } from './useGestureDispatcher';

function Probe({ dispatcher }: { dispatcher: Dispatcher | undefined }) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  registry?.register({
    id: 'probe', label: 'probe', defaultBinding: { kind: 'drag' },
    invoker: { timing: 'ongoing', start: () => ({ onMove: () => {}, onEnd: () => {} }) },
  });
  useGestureDispatcher({ canvasRef, actions: registry!, entriesById: new Map(), ...(dispatcher ? { dispatcher } : {}) });
  return <canvas ref={canvasRef} />;
}

const tree = (dispatcher: Dispatcher | undefined) => (
  <DepRegistryProvider>
    <ActiveToolContextProvider>
      <ActionsProvider><Probe dispatcher={dispatcher} /></ActionsProvider>
    </ActiveToolContextProvider>
  </DepRegistryProvider>
);

const press = (canvas: HTMLCanvasElement): void => {
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, buttons: 1, isPrimary: true, clientX: 0, clientY: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, buttons: 1, isPrimary: true, clientX: 40, clientY: 40 }));
  });
};

describe('the dispatcher option', () => {
  it('pumps events into a dispatcher supplied after the first render', () => {
    const shared = createDispatcher();
    const { container, rerender } = render(tree(undefined));
    rerender(tree(shared));
    press(container.querySelector('canvas')!);
    expect(shared.inFlight().size).toBe(1);
  });

  it('cancels the gestures of the dispatcher it is switched away from', () => {
    const first = createDispatcher();
    const { container, rerender } = render(tree(first));
    press(container.querySelector('canvas')!);
    expect(first.inFlight().size).toBe(1);
    const cancel = vi.spyOn(first, 'cancelAll');
    rerender(tree(createDispatcher()));
    expect(cancel).toHaveBeenCalledWith('cancel');
    expect(first.inFlight().size).toBe(0);
  });
});
