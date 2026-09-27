/**
 * Two dispatchers on one page both listen on `window`: a keystroke one of them
 * claims must not also run the other's binding.
 */
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  type Action,
  ActionsProvider,
  type ActionsRegistry,
  ActiveToolContextProvider,
  DepRegistryProvider,
  type Tool,
  useActionsRegistry,
  useGestureDispatcher,
} from '../../index';

const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const NO_ELEMENT = { current: null };

function Bound({ run, keyboard }: { run: () => void; keyboard?: boolean | 'first' }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  useEffect(
    () =>
      registry.register({
        id: 'test.q',
        label: 'Q',
        defaultBinding: { kind: 'key', key: 'q' },
        invoker: { timing: 'immediate' as const, run: () => run() },
      } satisfies Action),
    [registry, run],
  );
  useGestureDispatcher({
    canvasRef: NO_ELEMENT,
    actions: registry,
    toolsById: NO_TOOLS,
    channels: { contextMenu: false, ingest: false },
    ...(keyboard !== undefined ? { keyboard } : {}),
  });
  return null;
}

function Island(props: { run: () => void; keyboard?: boolean | 'first' }) {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <Bound {...props} />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

const press = () => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', cancelable: true })));

describe('a keystroke two dispatchers bind', () => {
  it('runs once, for whichever claims it first', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <>
        <Island run={a} />
        <Island run={b} />
      </>,
    );
    press();
    expect(a.mock.calls.length + b.mock.calls.length).toBe(1);
  });

  it("goes to a `keyboard: 'first'` dispatcher ahead of one mounted earlier", () => {
    const early = vi.fn();
    const first = vi.fn();
    render(
      <>
        <Island run={early} />
        <Island run={first} keyboard="first" />
      </>,
    );
    press();
    expect(first).toHaveBeenCalledTimes(1);
    expect(early).not.toHaveBeenCalled();
  });

  it('leaves a keystroke the page already claimed alone', () => {
    const run = vi.fn();
    render(<Island run={run} />);
    const claim = (e: KeyboardEvent) => e.preventDefault();
    window.addEventListener('keydown', claim, { capture: true });
    try {
      press();
    } finally {
      window.removeEventListener('keydown', claim, { capture: true });
    }
    expect(run).not.toHaveBeenCalled();
  });
});
