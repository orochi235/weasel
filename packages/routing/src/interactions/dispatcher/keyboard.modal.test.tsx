/** A key typed in a modal dialog never reaches a canvas behind it. */
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

function Canvas({ run }: { run: () => void }): ReactNode {
  const registry = useActionsRegistry()!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => registry.register({
    id: 'test.delete',
    label: 'Delete',
    defaultBinding: { kind: 'key', key: 'Backspace' },
    invoker: { timing: 'immediate', run: () => run() },
  } satisfies Action), [registry, run]);
  useGestureDispatcher({ canvasRef, actions: registry, entriesById: NO_ENTRIES });
  return <canvas ref={canvasRef} />;
}

function Page({ run, dialog, canvasWrap = {}, canvasInDialog = false }: {
  run: () => void;
  dialog: Record<string, string>;
  canvasWrap?: Record<string, string | boolean>;
  canvasInDialog?: boolean;
}): ReactNode {
  const scoped = <InputScope><Canvas run={run} /></InputScope>;
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <div {...canvasWrap}>{canvasInDialog ? null : scoped}</div>
          <div {...dialog}>
            <button type="button">OK</button>
            {canvasInDialog ? scoped : null}
          </div>
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

/** Backspace typed on the dialog's button, as a focused button would receive it. */
const backspaceOnButton = (): void => {
  const button = document.querySelector('button')!;
  act(() => { button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })); });
};

describe('a key typed in a dialog', () => {
  it.each(['dialog', 'alertdialog'])('never reaches the canvas behind a %s with aria-modal', (role) => {
    const run = vi.fn();
    render(<Page run={run} dialog={{ role, 'aria-modal': 'true' }} />);
    giveKeys(document.querySelector('canvas'));
    backspaceOnButton();
    expect(run).not.toHaveBeenCalled();
  });

  it('never reaches a canvas the dialog has made inert, as React Aria modals do instead of aria-modal', () => {
    const run = vi.fn();
    render(<Page run={run} dialog={{ role: 'dialog' }} canvasWrap={{ 'aria-hidden': 'true' }} />);
    giveKeys(document.querySelector('canvas'));
    backspaceOnButton();
    expect(run).not.toHaveBeenCalled();
  });

  it('reaches the canvas from a dialog that is not modal', () => {
    const run = vi.fn();
    render(<Page run={run} dialog={{ role: 'dialog' }} />);
    giveKeys(document.querySelector('canvas'));
    backspaceOnButton();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reaches a canvas inside the modal dialog itself', () => {
    const run = vi.fn();
    render(<Page run={run} dialog={{ role: 'dialog', 'aria-modal': 'true' }} canvasInDialog />);
    giveKeys(document.querySelector('canvas'));
    backspaceOnButton();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
