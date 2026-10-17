/**
 * A `contextmenu` with no press before it — the keyboard ContextMenu key —
 * makes the canvas it reached the active scope, as a press would. The menu
 * host resolves its rows through the root, which reads from the active scope:
 * without this, a menu opened on one of several sibling canvases ran its rows
 * against whichever scope was newest.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { ActionsRegistry } from '../actions/registry';
import { InputScope } from '../actions/inputScope';
import type { Action } from '../actions/action';

const NO_ENTRIES = new Map();

function Canvas({ name, row, root }: { name: string; row: () => void; root: () => ActionsRegistry }): ReactNode {
  const registry = useActionsRegistry()!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const leave = [
      registry.register({
        id: 'test.row', label: 'Row', invoker: { timing: 'immediate', run: () => row() },
      } satisfies Action),
      // What a menu row does: run through the root, as chrome does.
      registry.register({
        id: 'test.menu',
        label: 'Menu',
        defaultBinding: { kind: 'contextMenu' },
        invoker: { timing: 'immediate', run: () => { root().trigger('test.row'); } },
      } satisfies Action),
    ];
    return () => { for (const f of leave) f(); };
  }, [registry, row, root]);
  useGestureDispatcher({ canvasRef, actions: registry, entriesById: NO_ENTRIES });
  return <canvas ref={canvasRef} data-name={name} />;
}

function Root({ children }: { children: (root: () => ActionsRegistry) => ReactNode }): ReactNode {
  const registry = useActionsRegistry()!;
  return children(() => registry);
}

const canvas = (name: string): Element => document.querySelector(`canvas[data-name="${name}"]`)!;
const menuKey = (name: string): void => {
  act(() => { canvas(name).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
};

describe('a contextmenu with no press before it', () => {
  it('runs a menu row in the scope of the canvas it reached, of several siblings', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <DepRegistryProvider>
        <ActionsProvider>
          <ActiveToolContextProvider>
            <Root>
              {(root) => (
                <>
                  <InputScope><Canvas name="a" row={a} root={root} /></InputScope>
                  <InputScope><Canvas name="b" row={b} root={root} /></InputScope>
                </>
              )}
            </Root>
          </ActiveToolContextProvider>
        </ActionsProvider>
      </DepRegistryProvider>,
    );
    menuKey('a');
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 0]);
    menuKey('b');
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 1]);
  });
});
