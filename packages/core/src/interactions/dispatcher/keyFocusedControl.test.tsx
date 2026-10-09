/**
 * The dispatcher listens on `window`, so it hears keys aimed at every focused
 * element on the page. Space and Enter on a button are the button's.
 */
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function Bound({ keyName, run }: { keyName: string; run: () => void }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  useEffect(
    () =>
      registry.register({
        id: 'test.key',
        label: 'Key',
        defaultBinding: { kind: 'key', key: keyName },
        invoker: { timing: 'immediate' as const, run: () => run() },
      } satisfies Action),
    [registry, keyName, run],
  );
  useGestureDispatcher({
    canvasRef: NO_ELEMENT,
    actions: registry,
    entriesById: NO_TOOLS,
    channels: { contextMenu: false, ingest: false },
  });
  return null;
}

function Canvas(props: { keyName: string; run: () => void }) {
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

const pressOn = (target: EventTarget, key: string) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => void target.dispatchEvent(e));
  return e;
};

let button: HTMLButtonElement | null = null;
const aButton = () => {
  button = document.createElement('button');
  document.body.appendChild(button);
  return button;
};
afterEach(() => button?.remove());

describe('a key aimed at a focused control', () => {
  it('leaves Space on a button to the button', () => {
    const run = vi.fn();
    render(<Canvas keyName=" " run={run} />);
    const e = pressOn(aButton(), ' ');
    expect(run).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it('leaves Enter on a link to the link', () => {
    const run = vi.fn();
    render(<Canvas keyName="Enter" run={run} />);
    const a = document.createElement('a');
    a.href = '#';
    document.body.appendChild(a);
    pressOn(a, 'Enter');
    a.remove();
    expect(run).not.toHaveBeenCalled();
  });

  it('still takes Space from the page body', () => {
    const run = vi.fn();
    render(<Canvas keyName=" " run={run} />);
    pressOn(document.body, ' ');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('still takes a shortcut from a focused button, which does not act on it', () => {
    const run = vi.fn();
    render(<Canvas keyName="q" run={run} />);
    pressOn(aButton(), 'q');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
