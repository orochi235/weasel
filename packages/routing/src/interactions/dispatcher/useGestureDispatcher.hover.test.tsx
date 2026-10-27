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
import type { DispatcherChannels } from './gestureDispatcherOptions';
import { useGestureDispatcher } from './useGestureDispatcher';

function Probe({ actions, body, channels }: {
  actions: readonly Action[];
  body: () => 'empty' | 'unselected-body';
  channels?: DispatcherChannels;
}) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  for (const action of actions) registry?.register(action);
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    entriesById: new Map(),
    classifyTarget: () => ({ body: body() }),
    ...(channels ? { channels } : {}),
  });
  return <canvas ref={canvasRef} />;
}

function mount(
  actions: readonly Action[],
  body: () => 'empty' | 'unselected-body' = () => 'empty',
  channels?: DispatcherChannels,
) {
  const { container } = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Probe actions={actions} body={body} {...(channels ? { channels } : {})} />
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
    expect(typeof run.mock.calls[0][0].world.x).toBe('number');
  });

  it('runs again where the pointer rests when a modifier goes down or up, and not on a key repeat', () => {
    const run = vi.fn();
    const fire = mount([follow('readout', run, { defaultBinding: { kind: 'hover', mods: { alt: 'optional' } } })]);
    const key = (type: string, init: KeyboardEventInit) => act(() => { window.dispatchEvent(new KeyboardEvent(type, init)); });
    key('keydown', { key: 'Alt', altKey: true });
    expect(run).not.toHaveBeenCalled();
    fire('pointermove', { clientX: 5, clientY: 7 });
    key('keydown', { key: 'Alt', altKey: true });
    key('keydown', { key: 'Alt', altKey: true, repeat: true });
    key('keyup', { key: 'Alt', altKey: false });
    key('keydown', { key: 'a' });
    expect(run).toHaveBeenCalledTimes(3);
    expect(run.mock.calls[1][0]).toMatchObject({ clientX: 5, clientY: 7, mods: { alt: true } });
    expect(run.mock.calls[2][0]).toMatchObject({ clientX: 5, mods: { alt: false } });
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

  it('stands down for a held secondary button too, which opens no drag', () => {
    const run = vi.fn();
    const fire = mount([follow('readout', run)]);
    fire('pointerdown', { clientX: 5, clientY: 5, button: 2, buttons: 2 });
    fire('pointermove', { clientX: 40, clientY: 40, buttons: 2 });
    expect(run).not.toHaveBeenCalled();
    fire('pointerup', { clientX: 40, clientY: 40, button: 2 });
    fire('pointermove', { clientX: 41, clientY: 40 });
    expect(run).toHaveBeenCalledTimes(1);
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

describe('a hover binding for the pointer leaving', () => {
  const leaving = (id: string, run: (params: Record<string, unknown>) => void, target?: 'unselected-body') =>
    follow(id, run, { defaultBinding: target ? { kind: 'hover', motion: 'leave', target } : { kind: 'hover', motion: 'leave' } });

  it('runs when the pointer leaves the surface, with where it last was, and not on a move', () => {
    const run = vi.fn();
    const fire = mount([leaving('putAway', run)]);
    fire('pointermove', { clientX: 5, clientY: 7 });
    fire('pointermove', { clientX: 9, clientY: 7 });
    expect(run).not.toHaveBeenCalled();
    fire('pointerleave');
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({ clientX: 9, clientY: 7, bodyTarget: 'empty' });
  });

  it('has nothing to leave before the pointer has moved over the surface, or once it has left', () => {
    const run = vi.fn();
    const fire = mount([leaving('putAway', run)]);
    fire('pointerleave');
    expect(run).not.toHaveBeenCalled();
    fire('pointermove', { clientX: 5, clientY: 5 });
    fire('pointerleave');
    fire('pointerleave');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('with a target, runs when the pointer passes onto something the target does not match', () => {
    let body: 'empty' | 'unselected-body' = 'unselected-body';
    const run = vi.fn();
    const fire = mount([leaving('offBody', run, 'unselected-body')], () => body);
    fire('pointermove', { clientX: 5, clientY: 5 });
    fire('pointermove', { clientX: 6, clientY: 5 });
    expect(run).not.toHaveBeenCalled();
    body = 'empty';
    fire('pointermove', { clientX: 20, clientY: 5 });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({ clientX: 20, bodyTarget: 'empty' });
    fire('pointermove', { clientX: 21, clientY: 5 });
    fire('pointerleave');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('with a target, runs when the pointer leaves the surface from it', () => {
    const run = vi.fn();
    const fire = mount([leaving('offBody', run, 'unselected-body')], () => 'unselected-body');
    fire('pointermove', { clientX: 5, clientY: 5 });
    fire('pointerleave');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('leaves a binding without it alone when the pointer leaves the surface', () => {
    const move = vi.fn();
    const fire = mount([follow('readout', move)]);
    fire('pointermove', { clientX: 5, clientY: 5 });
    fire('pointerleave');
    expect(move).toHaveBeenCalledTimes(1);
  });
});


describe('a hover binding that a held button does not stand down', () => {
  it('with held optional, runs through a pressed drag and after it, saying which moves were held', () => {
    const run = vi.fn();
    const fire = mount([follow('aim', run, { defaultBinding: { kind: 'hover', held: 'optional' } })]);
    fire('pointermove', { clientX: 5, clientY: 5 });
    fire('pointerdown', { clientX: 5, clientY: 5, button: 0, buttons: 1 });
    fire('pointermove', { clientX: 40, clientY: 40, buttons: 1 });
    fire('pointermove', { clientX: 60, clientY: 40, buttons: 1 });
    fire('pointerup', { clientX: 60, clientY: 40, button: 0 });
    fire('pointermove', { clientX: 61, clientY: 40 });
    expect(run.mock.calls.map((c) => [c[0].clientX, c[0].held])).toEqual([
      [5, false], [40, true], [60, true], [61, false],
    ]);
  });

  it('leaves the drag its moves', () => {
    const onMove = vi.fn();
    const aim = vi.fn();
    const fire = mount([
      follow('aim', aim, { defaultBinding: { kind: 'hover', held: 'optional' } }),
      {
        id: 'drag', label: 'drag', defaultBinding: { kind: 'drag' },
        invoker: { timing: 'ongoing', start: () => ({ onMove, onEnd: () => {} }) },
      },
    ]);
    fire('pointerdown', { clientX: 5, clientY: 5, button: 0, buttons: 1 });
    fire('pointermove', { clientX: 40, clientY: 40, buttons: 1 });
    fire('pointermove', { clientX: 60, clientY: 40, buttons: 1 });
    expect(onMove).toHaveBeenCalled();
    expect(aim.mock.calls.map((c) => c[0].clientX)).toEqual([40, 60]);
  });

  it('with held required, runs only while a button is held', () => {
    const run = vi.fn();
    const fire = mount([follow('trail', run, { defaultBinding: { kind: 'hover', held: true } })]);
    fire('pointermove', { clientX: 5, clientY: 5 });
    fire('pointerdown', { clientX: 5, clientY: 5, button: 0, buttons: 1 });
    fire('pointermove', { clientX: 40, clientY: 40, buttons: 1 });
    fire('pointerup', { clientX: 40, clientY: 40, button: 0 });
    fire('pointermove', { clientX: 41, clientY: 40 });
    expect(run.mock.calls.map((c) => c[0].clientX)).toEqual([40]);
  });
});

describe('the hover channel on its own', () => {
  const HOVER_ONLY: DispatcherChannels = { pointer: false, hover: true };

  it('dispatches moves, held moves and the pointer leaving', () => {
    const aim = vi.fn();
    const left = vi.fn();
    const fire = mount([
      follow('aim', aim, { defaultBinding: { kind: 'hover', held: 'optional' } }),
      follow('left', left, { defaultBinding: { kind: 'hover', motion: 'leave' } }),
    ], () => 'empty', HOVER_ONLY);
    fire('pointermove', { clientX: 5, clientY: 5 });
    fire('pointerdown', { clientX: 5, clientY: 5, button: 0, buttons: 1 });
    fire('pointermove', { clientX: 9, clientY: 5, buttons: 1 });
    fire('pointerleave', { clientX: 9, clientY: 5, buttons: 1 });
    expect(aim.mock.calls.map((c) => [c[0].clientX, c[0].held])).toEqual([[5, false], [9, true]]);
    expect(left).toHaveBeenCalledTimes(1);
  });

  it('opens no press: nothing captures the pointer and a drag binding never starts', () => {
    // A proxy: jsdom captures nothing, so the test asserts nothing asked to.
    const start = vi.fn(() => ({ onMove: () => {}, onEnd: () => {} }));
    const fire = mount([{
      id: 'drag', label: 'drag', defaultBinding: { kind: 'drag' }, invoker: { timing: 'ongoing', start },
    }], () => 'empty', HOVER_ONLY);
    const capture = vi.fn();
    document.querySelector('canvas')!.setPointerCapture = capture;
    fire('pointerdown', { clientX: 5, clientY: 5, button: 0, buttons: 1 });
    fire('pointermove', { clientX: 40, clientY: 40, buttons: 1 });
    fire('pointerup', { clientX: 40, clientY: 40, button: 0 });
    expect(capture).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('stays off with the pointer channel unless asked for', () => {
    const aim = vi.fn();
    const fire = mount([follow('aim', aim)], () => 'empty', { pointer: false });
    fire('pointermove', { clientX: 5, clientY: 5 });
    expect(aim).not.toHaveBeenCalled();
  });
});
