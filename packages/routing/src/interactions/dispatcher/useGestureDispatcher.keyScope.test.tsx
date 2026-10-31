/**
 * Which canvas a key that reaches the page goes to: the one the user last
 * pressed or scrolled in, and none before the first such interaction.
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
import { heldKeySpec } from '../actions/toolOffhand';

const NO_ENTRIES = new Map();
const NO_POINTER = { pointer: false } as const;

function Canvas({ name, run, claimKeys, noCanvas, noPointer, over }: {
  name: string; run: () => void; claimKeys?: boolean; noCanvas?: boolean; noPointer?: boolean; over?: boolean;
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
  });
  return noCanvas ? null : <canvas ref={canvasRef} data-name={name} />;
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

  it('goes to a canvas scrolled in', () => {
    const run = vi.fn();
    render(<Root><InputScope><Canvas name="a" run={run} /></InputScope></Root>);
    act(() => { canvas('a').dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true })); });
    press();
    expect(run).toHaveBeenCalledTimes(1);
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
