/**
 * The browser's own `dblclick` follows the two clicks the dispatcher already
 * composed into a `doubleclick`. Once the dispatcher acted on it, that native
 * event is marked handled, so a container listening for double-clicks — a
 * lightbox, say — can tell the canvas spent it.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';

function Mount({ onDoubleClick }: { onDoubleClick?: () => void }): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const actions = useActionsRegistry();
  useGestureDispatcher({
    canvasRef,
    actions: actions!,
    entriesById: new Map(),
    clientToWorld: (x, y) => ({ x, y }),
    ...(onDoubleClick ? { onDoubleClick } : {}),
  });
  return <canvas ref={canvasRef} data-testid="c" />;
}

function mount(onDoubleClick?: () => void): Element {
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Mount {...(onDoubleClick ? { onDoubleClick } : {})} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return document.querySelector('[data-testid="c"]')!;
}

/** Two presses and the native `dblclick` a browser sends after them; returns
 *  that event so its `defaultPrevented` can be read. */
function doubleClick(canvas: Element): MouseEvent {
  const press = (): void => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }));
  };
  const native = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
  act(() => {
    press();
    press();
    canvas.dispatchEvent(native);
  });
  return native;
}

describe('the native dblclick after a dispatched doubleclick', () => {
  it('is marked handled when something observed the double click', () => {
    const observer = vi.fn();
    const native = doubleClick(mount(observer));
    expect(observer).toHaveBeenCalled();
    expect(native.defaultPrevented).toBe(true);
  });

  it('is left alone when nothing acted on it', () => {
    expect(doubleClick(mount()).defaultPrevented).toBe(false);
  });
});
