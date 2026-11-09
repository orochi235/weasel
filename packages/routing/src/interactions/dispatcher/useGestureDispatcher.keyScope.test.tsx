/**
 * Which canvas a key that reaches the page goes to: the one the user last
 * pressed or scrolled in, and none before the first such interaction.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { InputScope } from '../actions/inputScope';
import type { Action } from '../actions/action';
import type { ActionsRegistry } from '../actions/registry';
import { heldKeySpec } from '../actions/toolOffhand';

const NO_ENTRIES = new Map();
const NO_POINTER = { pointer: false } as const;

function Canvas({ name, run, claimKeys, noCanvas, noPointer, over, keyboard }: {
  name: string; run: () => void; claimKeys?: boolean; noCanvas?: boolean; noPointer?: boolean; over?: boolean; keyboard?: boolean;
}): ReactNode {
  const registry = useActionsRegistry()!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => registry.register({
    id: 'test.q',
    label: 'Q',
    defaultBinding: over ? [{ spec: { kind: 'key', key: 'q' }, opts: { over: true } }] : { kind: 'key', key: 'q' },
    invoker: { timing: 'immediate', run: () => run() },
  } satisfies Action), [registry, run, over]);
  useGestureDispatcher({
    canvasRef, actions: registry, entriesById: NO_ENTRIES,
    ...(claimKeys !== undefined ? { claimKeys } : {}),
    ...(noPointer ? { channels: NO_POINTER } : {}),
    ...(keyboard !== undefined ? { keyboard } : {}),
  });
  return noCanvas ? null : <canvas ref={canvasRef} data-name={name} />;
}

/** A dispatcher on `surface`, binding `q` to `run`. */
function OnSurface({ surface, run }: { surface: RefObject<HTMLDivElement | null>; run: () => void }): null {
  const registry = useActionsRegistry()!;
  useEffect(() => registry.register({
    id: 'test.q',
    label: 'Q',
    defaultBinding: { kind: 'key', key: 'q' },
    invoker: { timing: 'immediate', run: () => run() },
  } satisfies Action), [registry, run]);
  useGestureDispatcher({ canvasRef: surface, actions: registry, entriesById: NO_ENTRIES });
  return null;
}

/** A dispatcher whose surface is an element holding `children`. */
function Surface({ name, run, children }: { name: string; run: () => void; children: ReactNode }): ReactNode {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  return (
    <div ref={surfaceRef} data-name={name}>
      <OnSurface surface={surfaceRef} run={run} />
      {children}
    </div>
  );
}

/** Two dispatchers on one element, each in its own root, as a lab trial's camera listens on the
 *  pane its instrument dispatches on. `inner` attaches first, as an instrument does: its effects run
 *  before those of the trial that renders it. */
function SharedSurface({ outer, inner }: { outer: () => void; inner: () => void }): ReactNode {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  return (
    <div ref={surfaceRef} data-name="shared">
      <Root><OnSurface surface={surfaceRef} run={inner} /></Root>
      <OnSurface surface={surfaceRef} run={outer} />
    </div>
  );
}

/** A canvas dispatching on the registry above it, which binds nothing of its own. */
function BareCanvas({ name }: { name: string }): ReactNode {
  const registry = useActionsRegistry()!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useGestureDispatcher({ canvasRef, actions: registry, entriesById: NO_ENTRIES });
  return <canvas ref={canvasRef} data-name={name} />;
}

/** A dispatcher on `surface` binding `key` to `run`, under the id `id`. */
function KeyOnSurface({ surface, id, keyName, run }: {
  surface: RefObject<HTMLDivElement | null>; id: string; keyName: string; run: () => void;
}): null {
  const registry = useActionsRegistry()!;
  useEffect(() => registry.register({
    id,
    label: id,
    defaultBinding: { kind: 'key', key: keyName },
    invoker: { timing: 'immediate', run: () => run() },
  } satisfies Action), [registry, id, keyName, run]);
  useGestureDispatcher({ canvasRef: surface, actions: registry, entriesById: NO_ENTRIES });
  return null;
}

/** A canvas whose `over` binding peeks while Alt is held, as a loupe's does. */
function PeekCanvas({ name, peeking }: { name: string; peeking: (on: boolean) => void }): ReactNode {
  const registry = useActionsRegistry()!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => registry.register({
    id: 'test.peek',
    label: 'Peek',
    defaultBinding: [{ spec: heldKeySpec('Alt'), opts: { over: true } }],
    invoker: {
      timing: 'ongoing',
      start: () => {
        peeking(true);
        return { onEnd: () => peeking(false) };
      },
    },
  } satisfies Action), [registry, peeking]);
  useGestureDispatcher({ canvasRef, actions: registry, entriesById: NO_ENTRIES });
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
const hover = (name: string): void => {
  act(() => { canvas(name).dispatchEvent(new PointerEvent('pointermove', { bubbles: true })); });
};
const leave = (name: string): void => {
  act(() => { canvas(name).dispatchEvent(new PointerEvent('pointerleave')); });
};
const alt = (type: 'keydown' | 'keyup'): void => {
  act(() => { window.dispatchEvent(new KeyboardEvent(type, { key: 'Alt', code: 'AltLeft', altKey: type === 'keydown', cancelable: true })); });
};
const enter = (name: string, altKey = true): void => {
  act(() => { canvas(name).dispatchEvent(new PointerEvent('pointerenter', { altKey })); });
};
const canvas = (name: string): Element => document.querySelector(`canvas[data-name="${name}"]`)!;

describe('a key that reaches the page', () => {
  it('goes to no canvas before one has been pressed in, and then to that one', () => {
    const run = vi.fn();
    render(<Root><InputScope><Canvas name="a" run={run} /></InputScope></Root>);
    press();
    expect(run).not.toHaveBeenCalled();
    giveKeys(canvas('a'));
    press();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('goes to the canvas last pressed in', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <Root>
        <InputScope><Canvas name="a" run={a} /></InputScope>
        <InputScope><Canvas name="b" run={b} /></InputScope>
      </Root>,
    );
    giveKeys(canvas('a'));
    press();
    giveKeys(canvas('b'));
    press();
    press();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 2]);
  });

  it('stays with the canvas that holds it when one with its keyboard channel off is pressed or scrolled in', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <Root>
        <InputScope><Canvas name="a" run={a} /></InputScope>
        <InputScope><Canvas name="b" run={b} keyboard={false} /></InputScope>
      </Root>,
    );
    giveKeys(canvas('a'));
    giveKeys(canvas('b'));
    press();
    act(() => { canvas('b').dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true })); });
    press();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([2, 0]);
  });

  it('goes to a canvas scrolled in', () => {
    const run = vi.fn();
    render(<Root><InputScope><Canvas name="a" run={run} /></InputScope></Root>);
    act(() => { canvas('a').dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true })); });
    press();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('goes to the innermost of two nested surfaces pressed or scrolled in, not the one the event bubbles to next', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Root>
        <Surface name="outer" run={outer}>
          <Root><Canvas name="inner" run={inner} /></Root>
        </Surface>
      </Root>,
    );
    act(() => { canvas('inner').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    press();
    act(() => { canvas('inner').dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true })); });
    press();
    expect([outer.mock.calls.length, inner.mock.calls.length]).toEqual([0, 2]);
  });

  it('goes to the first of two dispatchers on one surface pressed or scrolled in, not the one attached after', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(<Root><SharedSurface outer={outer} inner={inner} /></Root>);
    const shared = document.querySelector('[data-name="shared"]')!;
    act(() => { shared.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    press();
    act(() => { shared.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true })); });
    press();
    expect([outer.mock.calls.length, inner.mock.calls.length]).toEqual([0, 2]);
  });

  it('fires once when two canvases on one registry hear it, on the one last pressed in', () => {
    const run = vi.fn();
    render(<Root><InputScope><Canvas name="a" run={run} /><BareCanvas name="b" /></InputScope></Root>);
    giveKeys(canvas('b'));
    press();
    giveKeys(canvas('a'));
    press();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('falls through to the other dispatcher on the surface when no binding in the active scope takes it', () => {
    const inner = vi.fn();
    const outer = vi.fn();
    const outerQ = vi.fn();
    function Pane(): ReactNode {
      const surfaceRef = useRef<HTMLDivElement | null>(null);
      return (
        <div ref={surfaceRef} data-name="pane">
          <Root><KeyOnSurface surface={surfaceRef} id="inner.q" keyName="q" run={inner} /></Root>
          <KeyOnSurface surface={surfaceRef} id="outer.m" keyName="m" run={outer} />
          <KeyOnSurface surface={surfaceRef} id="outer.q" keyName="q" run={outerQ} />
        </div>
      );
    }
    render(<Root><Pane /></Root>);
    const pane = document.querySelector('[data-name="pane"]')!;
    act(() => { pane.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    press();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', cancelable: true })); });
    expect([inner.mock.calls.length, outerQ.mock.calls.length, outer.mock.calls.length]).toEqual([1, 0, 1]);
  });

  it('goes to a canvas that claims the keys on mount', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <Root>
        <InputScope><Canvas name="a" run={a} claimKeys /></InputScope>
        <InputScope><Canvas name="b" run={b} /></InputScope>
      </Root>,
    );
    press();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 0]);
  });

  it('stays with a canvas that claims the keys when the registry it dispatches on changes', () => {
    const run = vi.fn();
    function Claiming({ registry }: { registry: ActionsRegistry }): ReactNode {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      useEffect(() => registry.register({
        id: 'test.q', label: 'Q', defaultBinding: { kind: 'key', key: 'q' },
        invoker: { timing: 'immediate', run: () => run() },
      } satisfies Action), [registry]);
      useGestureDispatcher({ canvasRef, actions: registry, entriesById: NO_ENTRIES, claimKeys: true });
      return <canvas ref={canvasRef} />;
    }
    function Pick({ which }: { which: 'a' | 'b' }): ReactNode {
      const outer = useActionsRegistry()!;
      return (
        <InputScope>
          <Inner pick={(inner) => (which === 'a' ? outer : inner)} />
        </InputScope>
      );
    }
    function Inner({ pick }: { pick: (inner: ActionsRegistry) => ActionsRegistry }): ReactNode {
      return <Claiming registry={pick(useActionsRegistry()!)} />;
    }
    const { rerender } = render(<Root><Pick which="a" /></Root>);
    rerender(<Root><Pick which="b" /></Root>);
    press();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('holds across separate roots: of two canvases with a provider each, the one last pressed in', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(<><Root><Canvas name="a" run={a} /></Root><Root><Canvas name="b" run={b} /></Root></>);
    press();
    giveKeys(canvas('b'));
    press();
    giveKeys(canvas('a'));
    press();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 1]);
  });

  it('goes to a dispatcher with no canvas to press in, as an app\'s own shortcuts have', () => {
    const run = vi.fn();
    render(<Root><Canvas name="none" run={run} noCanvas /></Root>);
    press();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('goes to a canvas pressed in though its pointer channel is off', () => {
    const run = vi.fn();
    render(<Root><InputScope><Canvas name="a" run={run} noPointer /></InputScope></Root>);
    giveKeys(canvas('a'));
    press();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('lets go when the canvas holding the keys unmounts', () => {
    const run = vi.fn();
    const { rerender } = render(<Root><InputScope><Canvas name="a" run={run} /></InputScope></Root>);
    giveKeys(canvas('a'));
    rerender(<Root><InputScope key="next"><Canvas name="b" run={run} /></InputScope></Root>);
    press();
    expect(run).not.toHaveBeenCalled();
  });
});

describe('a key bound with `over`', () => {
  it('goes to the canvas under the pointer, whichever holds the keys', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <Root>
        <InputScope><Canvas name="a" run={a} over /></InputScope>
        <InputScope><Canvas name="b" run={b} over /></InputScope>
      </Root>,
    );
    giveKeys(canvas('a'));
    hover('b');
    press();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([0, 1]);
  });

  it('goes to the canvas under the pointer before any has been pressed in', () => {
    const run = vi.fn();
    render(<Root><InputScope><Canvas name="a" run={run} over noPointer /></InputScope></Root>);
    hover('a');
    press();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('goes nowhere once the pointer leaves, though the canvas holds the keys', () => {
    const run = vi.fn();
    render(<Root><InputScope><Canvas name="a" run={run} over /></InputScope></Root>);
    giveKeys(canvas('a'));
    hover('a');
    leave('a');
    press();
    expect(run).not.toHaveBeenCalled();
  });

  it('leaves a key without it to the canvas holding the keys, wherever the pointer is', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <Root>
        <InputScope><Canvas name="a" run={a} /></InputScope>
        <InputScope><Canvas name="b" run={b} /></InputScope>
      </Root>,
    );
    giveKeys(canvas('a'));
    hover('b');
    press();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 0]);
  });
});

describe('a key held for an `over` binding', () => {
  it('presses it when the pointer arrives with the key already down', () => {
    const peeking = vi.fn();
    render(<Root><InputScope><PeekCanvas name="a" peeking={peeking} /></InputScope></Root>);
    alt('keydown');
    expect(peeking).not.toHaveBeenCalled();
    enter('a');
    expect(peeking.mock.calls).toEqual([[true]]);
    alt('keyup');
    expect(peeking.mock.calls).toEqual([[true], [false]]);
  });

  it('follows the pointer from one canvas to the next while held', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <Root>
        <InputScope><PeekCanvas name="a" peeking={a} /></InputScope>
        <InputScope><PeekCanvas name="b" peeking={b} /></InputScope>
      </Root>,
    );
    enter('a', false);
    alt('keydown');
    leave('a');
    enter('b');
    expect(a.mock.calls).toEqual([[true], [false]]);
    expect(b.mock.calls).toEqual([[true]]);
    leave('b');
    enter('a');
    alt('keyup');
    expect(a.mock.calls).toEqual([[true], [false], [true], [false]]);
    expect(b.mock.calls).toEqual([[true], [false]]);
  });

  it('presses nothing once the key is up', () => {
    const peeking = vi.fn();
    render(<Root><InputScope><PeekCanvas name="a" peeking={peeking} /></InputScope></Root>);
    alt('keydown');
    alt('keyup');
    enter('a', false);
    expect(peeking).not.toHaveBeenCalled();
  });

  it('does not repeat a single-press binding when the pointer arrives', () => {
    const run = vi.fn();
    render(<Root><InputScope><Canvas name="a" run={run} over /></InputScope></Root>);
    press();
    hover('a');
    expect(run).not.toHaveBeenCalled();
  });
});
