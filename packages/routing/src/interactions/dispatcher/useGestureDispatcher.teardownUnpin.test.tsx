/** Turning the dispatcher off while a pointer is held unpins that pointer from the view it pressed in. */
import { beforeAll, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher, type DispatcherViewTarget } from './useGestureDispatcher';
import { createDispatcher } from './dispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';

beforeAll(() => {
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});

it('ends the pointer in the view resolver when the listeners are torn down mid-press', () => {
  const pinned = new Set<number>();
  const resolver = {
    begin: (id: number) => { pinned.add(id); return { id: 'panel' }; },
    at: () => ({ id: 'panel' }),
    end: (id: number): void => { pinned.delete(id); },
  };
  const panel = createDispatcher();
  const target: DispatcherViewTarget = {
    id: 'panel', dispatcher: panel, affordanceAt: undefined, classifyTarget: undefined, clientToWorld: undefined,
  };
  function Mount({ enabled }: { enabled: boolean }): ReactNode {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    useGestureDispatcher({
      canvasRef, actions: registry!, entriesById: new Map(), dispatcher: createDispatcher(), enabled,
      views: { targets: () => [target], resolver },
    });
    return <canvas ref={canvasRef} data-testid="c" />;
  }
  const tree = (enabled: boolean): ReactNode => (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Mount enabled={enabled} /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
  const { rerender } = render(tree(true));
  const canvas = document.querySelector('[data-testid="c"]')!;
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: 150, clientY: 10,
    }));
  });
  expect(pinned.has(1)).toBe(true);
  rerender(tree(false));
  expect(pinned.has(1)).toBe(false);
});
