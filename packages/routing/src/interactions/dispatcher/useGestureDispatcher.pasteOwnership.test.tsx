/**
 * Every dispatcher on the page hears `paste` on `window`. One paste is
 * ingested once: by the active input scope, and not after something else
 * has claimed the event.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { InputScope } from '../actions/inputScope';
import type { Action } from '../actions/action';

const NO_ENTRIES = new Map();
const NO_ELEMENT = { current: null };

function Bound({ run, surface = NO_ELEMENT }: { run: () => void; surface?: RefObject<HTMLDivElement | null> }): ReactNode {
  const registry = useActionsRegistry()!;
  useEffect(() => registry.register({
    id: 'test.paste',
    label: 'Paste',
    defaultBinding: { kind: 'paste' },
    invoker: { timing: 'immediate', run: () => run() },
  } satisfies Action), [registry, run]);
  useGestureDispatcher({ canvasRef: surface, actions: registry, entriesById: NO_ENTRIES });
  return null;
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

function paste(): Event {
  const ev = new Event('paste', { cancelable: true });
  const file = new File(['x'], 'a.png', { type: 'image/png' });
  Object.assign(ev, { clipboardData: { files: [file], getData: () => '' } });
  act(() => { window.dispatchEvent(ev); });
  return ev;
}

describe('a paste several dispatchers bind', () => {
  it('runs once across separate roots', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(<><Root><Bound run={a} /></Root><Root><Bound run={b} /></Root></>);
    paste();
    expect(a.mock.calls.length + b.mock.calls.length).toBe(1);
  });

  it('runs once across two input scopes under one root', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <Root>
        <InputScope><Bound run={a} /></InputScope>
        <InputScope><Bound run={b} /></InputScope>
      </Root>,
    );
    paste();
    expect(a.mock.calls.length + b.mock.calls.length).toBe(1);
  });

  it('leaves a paste the page already claimed alone', () => {
    const run = vi.fn();
    render(<Root><Bound run={run} /></Root>);
    const claim = (e: Event): void => e.preventDefault();
    window.addEventListener('paste', claim, { capture: true });
    try {
      paste();
    } finally {
      window.removeEventListener('paste', claim, { capture: true });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('falls through to the other dispatcher on the surface when the one holding the keys binds none', () => {
    const run = vi.fn();
    function Bare({ surface }: { surface: RefObject<HTMLDivElement | null> }): null {
      useGestureDispatcher({ canvasRef: surface, actions: useActionsRegistry()!, entriesById: NO_ENTRIES });
      return null;
    }
    function Pane(): ReactNode {
      const surfaceRef = useRef<HTMLDivElement | null>(null);
      return (
        <div ref={surfaceRef} data-name="pane">
          <Root><Bare surface={surfaceRef} /></Root>
          <Bound run={run} surface={surfaceRef} />
        </div>
      );
    }
    render(<Root><Pane /></Root>);
    const pane = document.querySelector('[data-name="pane"]')!;
    act(() => { pane.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(paste().defaultPrevented).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });
});
