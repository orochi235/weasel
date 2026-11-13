/** An ongoing action whose `start` throws at a gesture is caught, as an immediate action's `run` is. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry } from '../actions/registry';
import type { Action } from '../actions/action';
import type { DepRegistry } from '../actions/depRegistry';
import type { InputEvent } from './matcher';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

function setup() {
  let throws = true;
  const onEnd = vi.fn();
  const drag: Action = {
    id: 'drag', label: 'drag',
    defaultBinding: { kind: 'drag' },
    invoker: {
      timing: 'ongoing',
      start: () => {
        if (throws) throw new Error('start failed');
        return { onMove: () => {}, onEnd };
      },
    },
  };
  const actions = { list: () => [drag] } as unknown as ActionsRegistry;
  const depRegistry: DepRegistry = { register: vi.fn().mockReturnValue(() => {}), get: vi.fn() as DepRegistry['get'] };
  const ctx: DispatcherContext = {
    depRegistry, actions, activeToolId: null, hotkeyStack: [], entriesById: new Map(), apple: false,
  };
  const d = createDispatcher({ getAction: (id) => (id === 'drag' ? drag : undefined) });
  const pointer = (kind: 'pointerdown' | 'pointerup'): InputEvent =>
    ({ kind, x: 0, y: 0, clientX: 0, clientY: 0, pointerId: 1, ...MODS } as unknown as InputEvent);
  return { d, ctx, pointer, onEnd, stopThrowing: () => { throws = false; } };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('an ongoing action whose start throws', () => {
  it('logs, consumes the press, leaves nothing in flight, and lets the next press start', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { d, ctx, pointer, onEnd, stopThrowing } = setup();
    expect(d.handleInput(pointer('pointerdown'), ctx)).toBe('handled');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"drag" threw on start'), expect.any(Error));
    expect(d.inFlight().size).toBe(0);
    d.handleInput(pointer('pointerup'), ctx);

    stopThrowing();
    expect(d.handleInput(pointer('pointerdown'), ctx)).toBe('handled');
    expect(d.inFlight().size).toBe(1);
    d.handleInput(pointer('pointerup'), ctx);
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
  });
});
