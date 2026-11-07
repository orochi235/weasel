/**
 * Where the keys go when the canvas holding them leaves: back to the canvas
 * used before it, and never away from a canvas that is still there.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { InputScope } from '../actions/inputScope';
import type { Action } from '../actions/action';

const NO_ENTRIES = new Map();
const NO_WHEEL = { wheel: false } as const;

function Canvas({ name, run, claimKeys, noWheel }: { name: string; run: () => void; claimKeys?: boolean; noWheel?: boolean }): ReactNode {
  const registry = useActionsRegistry()!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => registry.register({
    id: `test.q.${name}`,
    label: 'Q',
    defaultBinding: { kind: 'key', key: 'q' },
    invoker: { timing: 'immediate', run: () => run() },
  } satisfies Action), [registry, run, name]);
  useGestureDispatcher({
    canvasRef, actions: registry, entriesById: NO_ENTRIES,
    ...(claimKeys ? { claimKeys } : {}),
    ...(noWheel ? { channels: NO_WHEEL } : {}),
  });
  return <canvas ref={canvasRef} data-name={name} />;
}

function Root({ children }: { children: ReactNode }): ReactNode {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>{children}</ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

const press = (): void => {
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', cancelable: true })); });
};
const canvas = (name: string): Element => document.querySelector(`canvas[data-name="${name}"]`)!;

describe('when the canvas holding the keys unmounts', () => {
  it('gives them back to the canvas pressed in before it', () => {
    const board = vi.fn();
    const lightbox = vi.fn();
    const ui = (open: boolean): ReactNode => (
      <Root>
        <InputScope><Canvas name="board" run={board} /></InputScope>
        {open && <InputScope><Canvas name="lightbox" run={lightbox} /></InputScope>}
      </Root>
    );
    const { rerender } = render(ui(true));
    giveKeys(canvas('board'));
    giveKeys(canvas('lightbox'));
    press();
    rerender(ui(false));
    press();
    expect([board.mock.calls.length, lightbox.mock.calls.length]).toEqual([1, 1]);
  });

  it('gives them back to a canvas that claimed them on mount', () => {
    const board = vi.fn();
    const ui = (open: boolean): ReactNode => (
      <Root>
        <InputScope><Canvas name="board" run={board} claimKeys /></InputScope>
        {open && <InputScope><Canvas name="lightbox" run={() => {}} /></InputScope>}
      </Root>
    );
    const { rerender } = render(ui(true));
    giveKeys(canvas('lightbox'));
    rerender(ui(false));
    press();
    expect(board).toHaveBeenCalledTimes(1);
  });

  it('keeps them for another canvas on the same registry', () => {
    const board = vi.fn();
    const ui = (open: boolean): ReactNode => (
      <Root>
        <Canvas name="board" run={board} />
        {open && <Canvas name="lightbox" run={() => {}} />}
      </Root>
    );
    const { rerender } = render(ui(true));
    giveKeys(canvas('lightbox'));
    rerender(ui(false));
    press();
    expect(board).toHaveBeenCalledTimes(1);
  });

  it('leaves them where they were when a canvas other than the holder leaves', () => {
    const board = vi.fn();
    const ui = (open: boolean): ReactNode => (
      <Root>
        <InputScope><Canvas name="board" run={board} /></InputScope>
        {open && <InputScope><Canvas name="lightbox" run={() => {}} /></InputScope>}
      </Root>
    );
    const { rerender } = render(ui(true));
    giveKeys(canvas('lightbox'));
    giveKeys(canvas('board'));
    rerender(ui(false));
    press();
    expect(board).toHaveBeenCalledTimes(1);
  });
});

describe('a canvas whose listeners are bound again', () => {
  it('keeps the keys', () => {
    const run = vi.fn();
    const { rerender } = render(<Root><InputScope><Canvas name="a" run={run} /></InputScope></Root>);
    giveKeys(canvas('a'));
    rerender(<Root><InputScope><Canvas name="a" run={run} noWheel /></InputScope></Root>);
    press();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
