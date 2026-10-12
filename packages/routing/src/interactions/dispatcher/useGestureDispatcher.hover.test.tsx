/**
 * `hover`: the pointer moving with nothing pressed. A binding for it follows
 * the pointer through the dispatcher and claims nothing.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import type { Action } from '../actions/action';
import { useGestureDispatcher } from './useGestureDispatcher';

function Probe({ actions, body }: { actions: readonly Action[]; body: () => 'empty' | 'unselected-body' }) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  for (const action of actions) registry?.register(action);
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    entriesById: new Map(),
    classifyTarget: () => ({ body: body() }),
  });
  return <canvas ref={canvasRef} />;
}

function mount(actions: readonly Action[], body: () => 'empty' | 'unselected-body' = () => 'empty') {
  const { container } = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Probe actions={actions} body={body} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const canvas = container.querySelector('canvas')!;
  return (type: string, init: PointerEventInit = {}): PointerEvent => {
    const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, ...init });
    act(() => { canvas.dispatchEvent(e); });
    return e;
  };
}

const follow = (id: string, run: (params: Record<string, unknown>) => void, extra: Partial<Action> = {}): Action => ({
  id,
  label: id,
  defaultBinding: { kind: 'hover' },
  invoker: { timing: 'immediate', run: (_deps, params) => run(params as Record<string, unknown>) },
  ...extra,
});

describe('a hover binding', () => {
  it('runs on each move of an unpressed pointer, with where the pointer is', () => {
    const run = vi.fn();
    const fire = mount([follow('readout', run, { defaultBinding: { kind: 'hover', mods: { shift: 'optional' } } })]);
    fire('pointermove', { clientX: 5, clientY: 7 });
    fire('pointermove', { clientX: 9, clientY: 7, shiftKey: true });
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0][0]).toMatchObject({ clientX: 5, clientY: 7, bodyTarget: 'empty' });
    expect(run.mock.calls[1][0]).toMatchObject({ clientX: 9, mods: { shift: true } });
    expect(typeof run.mock.calls[0][0].worldX).toBe('number');
  });

  it('claims nothing: every hover binding runs, and the move is not canceled', () => {
    const a = vi.fn();
    const b = vi.fn();
    const fire = mount([follow('readout', a), follow('ruler', b)]);
    const e = fire('pointermove', { clientX: 5, clientY: 5 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(false);
  });

  it('stands down while a pointer is held, whose moves are the drag\'s', () => {
    const run = vi.fn();
    const fire = mount([follow('readout', run)]);
    fire('pointerdown', { clientX: 5, clientY: 5, button: 0, buttons: 1 });
    fire('pointermove', { clientX: 40, clientY: 40, buttons: 1 });
    expect(run).not.toHaveBeenCalled();
  });

  it('matches its target against what is under the pointer', () => {
    let body: 'empty' | 'unselected-body' = 'empty';
    const run = vi.fn();
    const fire = mount(
      [follow('overBody', run, { defaultBinding: { kind: 'hover', target: 'unselected-body' } })],
      () => body,
    );
    fire('pointermove', { clientX: 5, clientY: 5 });
    expect(run).not.toHaveBeenCalled();
    body = 'unselected-body';
    fire('pointermove', { clientX: 6, clientY: 5 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('refuses an ongoing action, which has no press to own', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const start = vi.fn(() => ({ onMove: () => {}, onEnd: () => {} }));
    const fire = mount([{
      id: 'held', label: 'held', defaultBinding: { kind: 'hover' }, invoker: { timing: 'ongoing', start },
    }]);
    fire('pointermove', { clientX: 5, clientY: 5 });
    expect(start).not.toHaveBeenCalled();
    expect(error.mock.calls.some((c) => String(c[0]).includes('hover'))).toBe(true);
    error.mockRestore();
  });
});
