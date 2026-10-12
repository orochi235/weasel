/**
 * A layout that types a character with AltGr reports Ctrl and Alt held with
 * it, so the strict modifier match sees a chord where the person typed a key.
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
  type GestureSpec,
  type Tool,
  useActionsRegistry,
  useGestureDispatcher,
} from '../../index';

const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const NO_ELEMENT = { current: null };

type Bindings = Record<string, { binding: GestureSpec; run: () => void }>;

function Bound({ bindings }: { bindings: Bindings }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  useEffect(() => {
    const off = Object.entries(bindings).map(([id, { binding, run }]) =>
      registry.register({
        id,
        label: id,
        defaultBinding: binding,
        invoker: { timing: 'immediate' as const, run: () => run() },
      } satisfies Action),
    );
    return () => off.forEach((f) => f());
  }, [registry, bindings]);
  useGestureDispatcher({
    canvasRef: NO_ELEMENT,
    actions: registry,
    entriesById: NO_TOOLS,
    channels: { contextMenu: false, ingest: false },
  });
  return null;
}

function mount(bindings: Bindings) {
  render(
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <Bound bindings={bindings} />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>,
  );
}

const press = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => void document.body.dispatchEvent(e));
  return e;
};

/** `[` as a German layout types it: AltGr+8, reported with Ctrl and Alt. */
const ALT_GRAPH_BRACKET = { key: '[', code: 'Digit8', ctrlKey: true, altKey: true, modifierAltGraph: true };

describe('a key typed with AltGr', () => {
  it('reports AltGraph through getModifierState here, so the cases below test the fix', () => {
    expect(new KeyboardEvent('keydown', ALT_GRAPH_BRACKET).getModifierState('AltGraph')).toBe(true);
  });

  it('matches a binding for the character it typed', () => {
    const run = vi.fn();
    mount({ 'test.bracket': { binding: { kind: 'key', key: '[' }, run } });
    const e = press(ALT_GRAPH_BRACKET);
    expect(run).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it('prefers a binding for the chord as reported', () => {
    const plain = vi.fn();
    const chord = vi.fn();
    mount({
      'test.plain': { binding: { kind: 'key', key: '[' }, run: plain },
      'test.chord': { binding: { kind: 'key', key: '[', mods: { ctrl: true, alt: true } }, run: chord },
    });
    press(ALT_GRAPH_BRACKET);
    expect(chord).toHaveBeenCalledTimes(1);
    expect(plain).not.toHaveBeenCalled();
  });

  it('leaves Ctrl+Alt on a key that typed its own letter a chord', () => {
    // Firefox on Windows reports AltGraph for a plain Ctrl+Alt as well.
    const run = vi.fn();
    mount({ 'test.k': { binding: { kind: 'key', key: 'k' }, run } });
    press({ key: 'k', code: 'KeyK', ctrlKey: true, altKey: true, modifierAltGraph: true });
    expect(run).not.toHaveBeenCalled();
  });

  it('leaves a real Ctrl+Alt chord alone when AltGraph is not reported', () => {
    const run = vi.fn();
    mount({ 'test.bracket': { binding: { kind: 'key', key: '[' }, run } });
    press({ key: '[', code: 'BracketLeft', ctrlKey: true, altKey: true });
    expect(run).not.toHaveBeenCalled();
  });
});
