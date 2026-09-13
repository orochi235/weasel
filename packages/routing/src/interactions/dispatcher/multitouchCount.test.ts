/**
 * Multitouch handles are keyed `multitouch-${fingers}`, so a finger landing or
 * lifting mid-gesture names a different gesture. Nothing ended the handle whose
 * count the hand had left, so a two-finger pinch and a three-finger swipe sat
 * in flight together — only the newer pumped, both painting overlays, and the
 * final lift committed both.
 */
import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry } from '../actions/registry';
import type { Action } from '../actions/action';
import type { DepRegistry } from '../actions/depRegistry';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';

function ongoing(id: string, log: string[]): Action {
  return {
    id, label: id,
    invoker: {
      timing: 'ongoing',
      start: () => {
        log.push(`start:${id}`);
        return { kind: id, onMove: () => {}, onEnd: (_c: unknown, r: string) => log.push(`end:${id}:${r}`) };
      },
    },
  } as unknown as Action;
}

function touch(fingers: number): InputEvent {
  return {
    kind: 'multitouch', fingers, centroid: { x: 0, y: 0 }, spread: 100,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
  } as unknown as InputEvent;
}

describe('a multitouch handle ends when the finger count moves on', () => {
  it('does not leave a two-finger handle in flight beside a three-finger one', () => {
    const log: string[] = [];
    const zoom = ongoing('zoom', log);
    const swipe = ongoing('swipe', log);
    const tool = {
      id: 'gestures', eligibility: { always: true },
      bindings: [
        { spec: { kind: 'multiTouch', fingers: 2 }, actionId: 'zoom' },
        { spec: { kind: 'multiTouch', fingers: 3 }, actionId: 'swipe' },
      ],
    } as unknown as Tool;
    const actions = {
      register: vi.fn(), unregister: vi.fn(), mute: vi.fn(), subscribe: vi.fn(),
      trigger: vi.fn(), begin: vi.fn(), setDispatcher: vi.fn(), setDepRegistry: vi.fn(),
      list: () => [zoom, swipe],
    } as unknown as ActionsRegistry;
    const depRegistry: DepRegistry = {
      register: vi.fn().mockReturnValue(() => {}), get: vi.fn() as DepRegistry['get'],
    };
    const ctx: DispatcherContext = {
      depRegistry, actions, activeToolId: 'select', hotkeyStack: [],
      toolsById: new Map([['gestures', tool]]), isMac: false,
    };
    const d = createDispatcher({
      getAction: (id) => (id === 'zoom' ? zoom : id === 'swipe' ? swipe : undefined),
    });

    d.handleInput(touch(2), ctx);
    d.handleInput(touch(3), ctx);

    expect([...d.inFlight().keys()]).toEqual(['multitouch-3']);
    expect(log).toEqual(['start:zoom', 'end:zoom:cancel', 'start:swipe']);
  });
});
