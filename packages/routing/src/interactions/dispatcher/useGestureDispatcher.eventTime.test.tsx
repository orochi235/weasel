/**
 * The pointer channel hands the recognizer each event's own `timeStamp`, so a
 * double click survives a long task that delays its second click's handling.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';

function Mount({ onDoubleClick }: { onDoubleClick: () => void }): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const actions = useActionsRegistry();
  useGestureDispatcher({
    canvasRef,
    actions: actions!,
    entriesById: new Map(),
    clientToWorld: (x, y) => ({ x, y }),
    onDoubleClick,
  });
  return <canvas ref={canvasRef} data-testid="c" />;
}

function mount(onDoubleClick: () => void): Element {
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Mount onDoubleClick={onDoubleClick} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return document.querySelector('[data-testid="c"]')!;
}

/** A pointer event stamped `timeStamp`, as jsdom's own constructor will not take one. */
function stamped(type: string, timeStamp: number): PointerEvent {
  const e = new PointerEvent(type, { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 });
  Object.defineProperty(e, 'timeStamp', { value: timeStamp });
  return e;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('a double click whose second click is handled late', () => {
  it('composes when the clicks happened inside the window', () => {
    const now = vi.spyOn(performance, 'now');
    const observed = vi.fn();
    const canvas = mount(observed);
    const click = (happened: number, handled: number): void => {
      now.mockReturnValue(handled);
      const down = stamped('pointerdown', happened);
      const up = stamped('pointerup', happened);
      // The premise: jsdom's events report the stamp set on them.
      expect([down.timeStamp, up.timeStamp]).toEqual([happened, happened]);
      canvas.dispatchEvent(down);
      canvas.dispatchEvent(up);
    };
    act(() => {
      click(1000, 1000);
      click(1300, 2000);
    });
    expect(observed).toHaveBeenCalledOnce();
  });
});
