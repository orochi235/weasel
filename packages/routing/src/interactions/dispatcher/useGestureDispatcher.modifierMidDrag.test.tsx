import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import type { InvocationCtx } from '../actions/invoker';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';

function Probe({ actionDef }: { actionDef: Action }) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  registry?.register(actionDef);
  useGestureDispatcher({
    canvasRef, actions: registry!, entriesById: new Map(), classifyTarget: () => ({ body: 'empty' }),
  });
  return <canvas ref={canvasRef} />;
}

const fire = (el: Element, type: string, init: PointerEventInit = {}) => {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, buttons: 1, ...init }));
};

function mount() {
  const moves: Array<{ x: number; shift: boolean; alt: boolean }> = [];
  const ends: Array<{ shift: boolean }> = [];
  const drag: Action = {
    id: 'demo.drag',
    label: 'drag',
    defaultBinding: { kind: 'drag' },
    invoker: {
      timing: 'ongoing',
      start: () => ({
        onMove: (c: InvocationCtx) => { moves.push({ x: c.world.x, shift: c.modifiers.shift, alt: c.modifiers.alt }); },
        onEnd: (c: InvocationCtx) => { ends.push({ shift: c.modifiers.shift }); },
      }),
    },
  };
  const { container } = render(
    <DepRegistryProvider><ActiveToolContextProvider><ActionsProvider>
      <Probe actionDef={drag} />
    </ActionsProvider></ActiveToolContextProvider></DepRegistryProvider>,
  );
  return { canvas: container.querySelector('canvas')!, moves, ends };
}

describe('a modifier changing mid-drag', () => {
  it('reaches the drag at once, at the pointer where it rests', () => {
    const { canvas, moves } = mount();
    act(() => {
      fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
      fire(canvas, 'pointermove', { clientX: 40, clientY: 0, pointerId: 1 });
    });
    const before = moves.length;
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true })); });
    expect(moves.slice(before)).toEqual([{ x: 40, shift: true, alt: false }]);
    act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', code: 'ShiftLeft', shiftKey: false })); });
    expect(moves.at(-1)).toEqual({ x: 40, shift: false, alt: false });
    act(() => { fire(canvas, 'pointerup', { clientX: 40, clientY: 0, pointerId: 1, buttons: 0 }); });
  });

  it('sends nothing for a key that changes no modifier', () => {
    const { canvas, moves } = mount();
    act(() => {
      fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
      fire(canvas, 'pointermove', { clientX: 40, clientY: 0, pointerId: 1 });
    });
    const before = moves.length;
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' })); });
    expect(moves.length).toBe(before);
    act(() => { fire(canvas, 'pointerup', { clientX: 40, clientY: 0, pointerId: 1, buttons: 0 }); });
  });
});
