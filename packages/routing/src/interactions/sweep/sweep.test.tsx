import { afterEach, describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from '../dispatcher/useGestureDispatcher';
import { openPointerSession } from '../pointerSession';
import { sweepAction, type SweepOptions } from './sweep';

const KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

// jsdom lays nothing out: each item is a 10px column, item `i` spanning x = 10i to 10i + 9.
function layOut(host: HTMLElement): void {
  document.elementFromPoint = (x: number) => host.querySelectorAll('[data-key]')[Math.floor(x / 10)] ?? host;
}

afterEach(() => { delete (document as { elementFromPoint?: unknown }).elementFromPoint; });

function Row({ sweep, actions = [], ownDrag }: {
  sweep: Omit<SweepOptions<string>, 'surface' | 'keyOf'> & Partial<Pick<SweepOptions<string>, 'keyOf'>>;
  actions?: Action[];
  ownDrag?: string;
}) {
  const registry = useActionsRegistry();
  const hostRef = useRef<HTMLDivElement | null>(null);
  registry?.register(sweepAction({
    surface: () => hostRef.current,
    keyOf: (el) => (el as HTMLElement).dataset.key,
    ...sweep,
  }));
  for (const a of actions) registry?.register(a);
  useGestureDispatcher({ canvasRef: hostRef, actions: registry!, entriesById: new Map(), controls: 'take' });
  return (
    <div ref={hostRef} data-testid="row">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          data-key={k}
          onPointerDown={k === ownDrag ? (e) => { openPointerSession(e.currentTarget, e, {}); } : undefined}
        >{k}</button>
      ))}
    </div>
  );
}

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>{children}</ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}

function pointer(el: Element, type: string, x: number, init: PointerEventInit = {}): void {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: 5, ...init }));
}

function setup(props: Parameters<typeof Row>[0]) {
  const utils = render(<Harness><Row {...props} /></Harness>);
  const row = utils.getByTestId('row');
  layOut(row);
  const at = (x: number) => document.elementFromPoint(x, 5)!;
  return { row, at };
}

describe('sweepAction', () => {
  it('enters the pressed item, then every item the drag crosses, in order', () => {
    const entered: string[] = [];
    const end = vi.fn();
    const { at } = setup({ sweep: { begin: () => ({ enter: (i) => entered.push(i.key), end }) } });
    act(() => {
      pointer(at(5), 'pointerdown', 5);
      pointer(at(5), 'pointermove', 12);
      // One move jumping three items: the ones between are still reached.
      pointer(at(5), 'pointermove', 47);
      pointer(at(5), 'pointerup', 47);
    });
    expect(entered).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(end).toHaveBeenCalledWith('commit');
  });

  it('enters an item again when the drag comes back over it', () => {
    const entered: string[] = [];
    const { at } = setup({ sweep: { begin: () => ({ enter: (i) => entered.push(i.key) }) } });
    act(() => {
      pointer(at(5), 'pointerdown', 5);
      pointer(at(5), 'pointermove', 15);
      pointer(at(5), 'pointermove', 5);
      pointer(at(5), 'pointerup', 5);
    });
    expect(entered).toEqual(['a', 'b', 'a']);
  });

  it('hands begin the press: the item and the modifiers held', () => {
    const begin = vi.fn(() => ({ enter: () => {} }));
    const { at } = setup({ sweep: { begin } });
    act(() => {
      pointer(at(25), 'pointerdown', 25, { altKey: true });
      pointer(at(25), 'pointermove', 40, { altKey: true });
      pointer(at(25), 'pointerup', 40);
    });
    expect(begin).toHaveBeenCalledTimes(1);
    const [press] = begin.mock.calls[0] as unknown as [{ key: string; ctx: { modifiers: { alt: boolean } } }];
    expect(press.key).toBe('c');
    expect(press.ctx.modifiers.alt).toBe(true);
  });

  it('ends with cancel when the pointer is canceled', () => {
    const end = vi.fn();
    const { at } = setup({ sweep: { begin: () => ({ enter: () => {}, end }) } });
    act(() => {
      pointer(at(5), 'pointerdown', 5);
      pointer(at(5), 'pointermove', 25);
      pointer(at(5), 'pointercancel', 25);
    });
    expect(end).toHaveBeenCalledWith('cancel');
  });

  it('declines a press accepts refuses, and the next drag binding takes it', () => {
    const begin = vi.fn(() => ({ enter: () => {} }));
    const other = vi.fn(() => ({ onMove: () => {} }));
    const fallback: Action = {
      id: 'demo.drag', label: 'drag', defaultBinding: { kind: 'drag' }, invoker: { timing: 'ongoing', start: other },
    };
    const { at } = setup({ sweep: { begin, accepts: (i) => i.key !== 'b' }, actions: [fallback] });
    act(() => { pointer(at(15), 'pointerdown', 15); pointer(at(15), 'pointermove', 40); pointer(at(15), 'pointerup', 40); });
    expect(begin).not.toHaveBeenCalled();
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('runs either the sweep or a drag that outranks it, never both', () => {
    const ran = { sweep: 0, shifted: 0 };
    const shiftDrag: Action = {
      id: 'demo.shiftDrag', label: 'shift drag',
      defaultBinding: { kind: 'drag', mods: { shift: true } },
      invoker: { timing: 'ongoing', start: () => { ran.shifted++; return { onMove: () => {} }; } },
    };
    const { at } = setup({ sweep: { begin: () => { ran.sweep++; return { enter: () => {} }; } }, actions: [shiftDrag] });
    act(() => {
      pointer(at(5), 'pointerdown', 5, { shiftKey: true });
      pointer(at(5), 'pointermove', 30, { shiftKey: true });
      pointer(at(5), 'pointerup', 30, { shiftKey: true });
    });
    expect(ran).toEqual({ sweep: 0, shifted: 1 });
    act(() => { pointer(at(5), 'pointerdown', 5); pointer(at(5), 'pointermove', 30); pointer(at(5), 'pointerup', 30); });
    expect(ran).toEqual({ sweep: 1, shifted: 1 });
  });

  it("does not start from an item that runs a drag of its own", () => {
    const begin = vi.fn(() => ({ enter: () => {} }));
    const { at } = setup({ sweep: { begin }, ownDrag: 'a' });
    act(() => { pointer(at(5), 'pointerdown', 5); pointer(at(5), 'pointermove', 30); pointer(at(5), 'pointerup', 30); });
    expect(begin).not.toHaveBeenCalled();
  });
});
