import { expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import type { HeldPointerFeed } from './gestureDispatcherOptions';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';

const NO_ENTRIES = new Map();

function Canvas({ heldPointer }: { heldPointer: (feed: HeldPointerFeed | null) => void }): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useGestureDispatcher({ canvasRef, actions: useActionsRegistry()!, entriesById: NO_ENTRIES, heldPointer });
  return <canvas ref={canvasRef} />;
}

const Root = ({ children }: { children: ReactNode }): ReactNode => (
  <DepRegistryProvider><ActionsProvider><ActiveToolContextProvider>{children}</ActiveToolContextProvider></ActionsProvider></DepRegistryProvider>
);

it('moves the held-pointer feed to a new heldPointer callback, and ends it on the one that has it', () => {
  const a = vi.fn();
  const b = vi.fn();
  const { rerender, unmount } = render(<Root><Canvas heldPointer={a} /></Root>);
  expect(a.mock.calls).toEqual([[expect.objectContaining({ at: expect.any(Function) })]]);
  rerender(<Root><Canvas heldPointer={b} /></Root>);
  expect(a.mock.calls.at(-1)).toEqual([null]);
  expect(b.mock.calls).toEqual([[a.mock.calls[0]![0]]]);
  unmount();
  expect(a).toHaveBeenCalledTimes(2);
  expect(b.mock.calls.at(-1)).toEqual([null]);
});
