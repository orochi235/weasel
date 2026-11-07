/** A key typed in a native `<dialog>` opened with `showModal()` never reaches a canvas behind it. */
import { act, cleanup, render } from '@testing-library/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ActionsProvider, ActiveToolContextProvider, DepRegistryProvider, InputScope, useActionsRegistry, useGestureDispatcher } from '@weasel-js/routing/react';
import type { Action } from '@weasel-js/routing';

afterEach(cleanup);

function Canvas({ run }: { run: () => void }): ReactNode {
  const registry = useActionsRegistry()!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => registry.register({
    id: 'test.delete',
    label: 'Delete',
    defaultBinding: { kind: 'key', key: 'Backspace' },
    invoker: { timing: 'immediate', run: () => run() },
  } satisfies Action), [registry, run]);
  useGestureDispatcher({ canvasRef, actions: registry, entriesById: new Map(), claimKeys: true });
  return <canvas ref={canvasRef} width={100} height={100} />;
}

function Page({ run }: { run: () => void }): ReactNode {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <InputScope><Canvas run={run} /></InputScope>
          <dialog><button type="button">OK</button></dialog>
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

const backspaceOnButton = (): void => {
  const button = document.querySelector('dialog button')!;
  act(() => { button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })); });
};

it('reaches the canvas while the dialog is open without being modal', () => {
  const run = vi.fn();
  render(<Page run={run} />);
  document.querySelector('dialog')!.show();
  backspaceOnButton();
  expect(run).toHaveBeenCalledTimes(1);
});

it('never reaches the canvas while the dialog is open modally', () => {
  const run = vi.fn();
  render(<Page run={run} />);
  document.querySelector('dialog')!.showModal();
  backspaceOnButton();
  expect(run).not.toHaveBeenCalled();
});
