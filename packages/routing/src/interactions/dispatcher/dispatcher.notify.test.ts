/**
 * Subscribers re-render whatever draws in-flight gestures, so an event that
 * neither found nor left a gesture in flight is not worth telling them about:
 * hover alone sends a `pointermove` per mouse event.
 */
import { describe, expect, it, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry } from '../actions/registry';
import type { Action } from '../actions/action';
import type { DepRegistry } from '../actions/depRegistry';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const pointer = (kind: 'pointerdown' | 'pointermove' | 'pointerup'): InputEvent =>
  ({ kind, x: 0, y: 0, clientX: 0, clientY: 0, pointerId: 1, ...MODS } as unknown as InputEvent);
const keyQ = { kind: 'key', key: 'q', repeat: false, ...MODS } as unknown as InputEvent;

function setup() {
  const ran = vi.fn();
  const drag = {
    id: 'drag', label: 'drag',
    invoker: { timing: 'ongoing', start: () => ({ onMove: () => {}, onEnd: () => {} }) },
  } as unknown as Action;
  const quick = {
    id: 'quick', label: 'quick', invoker: { timing: 'immediate', run: ran },
  } as unknown as Action;
  const byId = new Map([drag, quick].map((a) => [a.id, a]));
  const tool = {
    id: 'tool', eligibility: { always: true },
    bindings: [
      { spec: { kind: 'drag' }, actionId: 'drag' },
      { spec: { kind: 'key', key: 'q' }, actionId: 'quick' },
    ],
  } as unknown as Tool;
  const actions = {
    register: vi.fn(), unregister: vi.fn(), mute: vi.fn(), subscribe: vi.fn(),
    trigger: vi.fn(), begin: vi.fn(), setDispatcher: vi.fn(),
    list: () => [...byId.values()],
  } as unknown as ActionsRegistry;
  const depRegistry: DepRegistry = {
    register: vi.fn().mockReturnValue(() => {}), get: vi.fn() as DepRegistry['get'],
  };
  const ctx: DispatcherContext = {
    depRegistry, actions, activeToolId: 'select', hotkeyStack: [],
    entriesById: new Map([['tool', tool]]), isMac: false,
  };
  const d = createDispatcher({ getAction: (id) => byId.get(id) });
  const seen = vi.fn();
  d.subscribe(seen);
  return { d, ctx, seen, ran };
}

describe('dispatcher subscribers', () => {
  it('hear nothing from a hover move with no gesture in flight', () => {
    const { d, ctx, seen } = setup();
    d.handleInput(pointer('pointermove'), ctx);
    expect(seen).not.toHaveBeenCalled();
    expect(d.getVersion()).toBe(0);
  });

  it('hear nothing from an immediate action with no gesture in flight', () => {
    const { d, ctx, seen, ran } = setup();
    d.handleInput(keyQ, ctx);
    expect(ran).toHaveBeenCalledTimes(1);
    expect(seen).not.toHaveBeenCalled();
  });

  it('hear nothing from a cancelAll with nothing to cancel', () => {
    const { d, seen } = setup();
    d.cancelAll('cancel');
    expect(seen).not.toHaveBeenCalled();
  });

  it('hear a gesture start, each pump, and its end', () => {
    const { d, ctx, seen } = setup();
    d.handleInput(pointer('pointerdown'), ctx);
    expect(seen).toHaveBeenCalledTimes(1);
    d.handleInput(pointer('pointermove'), ctx);
    expect(seen).toHaveBeenCalledTimes(2);
    d.handleInput(pointer('pointerup'), ctx);
    expect(seen).toHaveBeenCalledTimes(3);
    expect(d.getVersion()).toBe(3);
  });

  it('hear every event while a gesture is in flight', () => {
    const { d, ctx, seen } = setup();
    d.handleInput(pointer('pointerdown'), ctx);
    d.handleInput(keyQ, ctx);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('hear a cancelAll that ended something', () => {
    const { d, ctx, seen } = setup();
    d.handleInput(pointer('pointerdown'), ctx);
    d.cancelAll('cancel');
    expect(seen).toHaveBeenCalledTimes(2);
    expect(d.getVersion()).toBe(2);
  });

  it('still hear a change after a subscriber that throws', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { d, ctx } = setup();
    const after = vi.fn();
    d.subscribe(() => { throw new Error('boom'); });
    d.subscribe(after);
    expect(d.handleInput(pointer('pointerdown'), ctx)).toBe('handled');
    expect(after).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });
});
