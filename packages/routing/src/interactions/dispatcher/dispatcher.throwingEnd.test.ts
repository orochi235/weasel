/**
 * An action that throws while ending must not stay in flight: an in-flight
 * handle is what the hover-cursor pump, the overlay layer, and `phase:
 * 'initial'` bindings all read as "a gesture is happening".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry } from '../actions/registry';
import type { Action } from '../actions/action';
import type { DepRegistry } from '../actions/depRegistry';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

function ongoing(id: string, log: string[], throws: boolean): Action {
  return {
    id, label: id,
    invoker: {
      timing: 'ongoing',
      start: () => ({
        kind: id,
        onMove: () => {},
        onEnd: (_c: unknown, reason: string) => {
          log.push(`end:${id}:${reason}`);
          if (throws) throw new Error(`${id} failed to end`);
        },
      }),
    },
  } as unknown as Action;
}

function setup(log: string[]) {
  const bad = ongoing('bad', log, true);
  const good = ongoing('good', log, false);
  const hold = ongoing('hold', log, true);
  const byId = new Map([bad, good, hold].map((a) => [a.id, a]));
  const tool = {
    id: 'tool', eligibility: { always: true },
    bindings: [
      { spec: { kind: 'drag', target: { kindOf: (h: unknown) => h === 'bad' } }, actionId: 'bad' },
      { spec: { kind: 'drag', target: { kindOf: (h: unknown) => h === 'good' } }, actionId: 'good' },
      { spec: { kind: 'key-held', key: 'h' }, actionId: 'hold' },
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
  const pointer = (kind: 'pointerdown' | 'pointerup' | 'pointercancel', pointerId: number, affordance?: string): InputEvent => ({
    kind, x: 0, y: 0, clientX: 0, clientY: 0, pointerId, ...MODS,
    ...(affordance !== undefined ? { affordance } : {}),
  } as unknown as InputEvent);
  const held = (phase: 'down' | 'up'): InputEvent =>
    ({ kind: 'key-held', key: 'h', phase, ...MODS } as unknown as InputEvent);
  return { d, ctx, pointer, held };
}

describe('a handle whose onEnd throws', () => {
  let error: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { error = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { error.mockRestore(); });

  it.each(['pointerup', 'pointercancel'] as const)('is out of flight after %s', (kind) => {
    const log: string[] = [];
    const { d, ctx, pointer } = setup(log);
    d.handleInput(pointer('pointerdown', 1, 'bad'), ctx);
    expect([...d.inFlight().keys()]).toEqual(['pointer-1']);

    expect(d.handleInput(pointer(kind, 1), ctx)).toBe('handled');

    expect(d.inFlight().size).toBe(0);
    expect(d.getActiveAction()).toEqual({ kind: null, id: null });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('is out of flight after its key comes up', () => {
    const log: string[] = [];
    const { d, ctx, held } = setup(log);
    d.handleInput(held('down'), ctx);
    expect(d.inFlight().size).toBe(1);

    d.handleInput(held('up'), ctx);

    expect(d.inFlight().size).toBe(0);
  });

  it('does not stop cancelAll from ending the handles after it', () => {
    const log: string[] = [];
    const { d, ctx, pointer } = setup(log);
    d.handleInput(pointer('pointerdown', 1, 'bad'), ctx);
    d.handleInput(pointer('pointerdown', 2, 'good'), ctx);

    d.cancelAll('cancel');

    expect(log).toEqual(['end:bad:cancel', 'end:good:cancel']);
    expect(d.inFlight().size).toBe(0);
  });

  it('still notifies subscribers', () => {
    const log: string[] = [];
    const { d, ctx, pointer } = setup(log);
    d.handleInput(pointer('pointerdown', 1, 'bad'), ctx);
    const seen = vi.fn();
    d.subscribe(seen);

    d.handleInput(pointer('pointerup', 1), ctx);

    expect(seen).toHaveBeenCalledTimes(1);
  });
});
