/**
 * Two readers of "which gesture is happening right now" that disagreed.
 *
 * `getActiveAction` documents and implements latest-start-wins, which is what
 * makes a mouse and a pen usable together. `inFlightCursor` returned the first
 * entry in the same map, so the cursor stayed with whichever gesture started
 * first. Same shape in the hotkey tier: `pushHotkey` appends, `hotkeyStack` is
 * documented "top of stack last", and `ToolsApi.hotkeyEngaged` reads `.at(-1)`
 * — but the dispatcher assembled the stack bottom-first, handing
 * same-specificity ties to the oldest hold.
 */
import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry } from '../actions/registry';
import type { Action } from '../actions/action';
import type { DepRegistry } from '../actions/depRegistry';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';

function ongoing(id: string, activeCursor?: string, onStart?: () => void): Action {
  return {
    id, label: id, activeCursor,
    invoker: {
      timing: 'ongoing',
      start: () => { onStart?.(); return { kind: id, onMove: () => {}, onEnd: () => {} }; },
    },
  } as unknown as Action;
}

function registryOf(actions: Action[]): ActionsRegistry {
  const byId = new Map(actions.map((a) => [a.id, a]));
  return {
    register: vi.fn(), unregister: vi.fn(), mute: vi.fn(), subscribe: vi.fn(),
    trigger: vi.fn(), begin: vi.fn(), setDispatcher: vi.fn(), setDepRegistry: vi.fn(),
    list: () => [...byId.values()],
  } as unknown as ActionsRegistry;
}

function ctxOf(actions: ActionsRegistry, tools: [string, Tool][], hotkeyStack: string[] = []): DispatcherContext {
  const depRegistry: DepRegistry = {
    register: vi.fn().mockReturnValue(() => {}), get: vi.fn() as DepRegistry['get'],
  };
  return {
    depRegistry, actions, activeToolId: 'select', hotkeyStack,
    toolsById: new Map(tools), isMac: false,
  };
}

function down(pointerId: number, affordance?: unknown): InputEvent {
  return {
    kind: 'pointerdown', x: 0, y: 0, clientX: 0, clientY: 0, pointerId,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    ...(affordance !== undefined ? { affordance } : {}),
  } as unknown as InputEvent;
}

describe('the most recently started gesture wins', () => {
  it('inFlightCursor agrees with getActiveAction', () => {
    const move = ongoing('move', 'grabbing');
    const rotate = ongoing('rotate', 'alias');
    // Two ambient bindings that discriminate on the affordance, so the two
    // pointers start two different actions and both handles stay in flight —
    // a mouse and a pen used together, which is what `getActiveAction`'s own
    // docstring names as the case latest-wins exists for.
    const tools: [string, Tool][] = [
      ['grab', { id: 'grab', eligibility: { always: true },
        bindings: [{ spec: { kind: 'drag', target: { kindOf: (h: unknown) => h === 'body' } },
          actionId: 'move' }] } as unknown as Tool],
      ['spin', { id: 'spin', eligibility: { always: true },
        bindings: [{ spec: { kind: 'drag', target: { kindOf: (h: unknown) => h === 'handle' } },
          actionId: 'rotate' }] } as unknown as Tool],
    ];
    const reg = registryOf([move, rotate]);
    const d = createDispatcher({ getAction: (id) => (id === 'move' ? move : id === 'rotate' ? rotate : undefined) });
    const ctx = ctxOf(reg, tools);

    d.handleInput(down(1, 'body'), ctx);
    d.handleInput(down(2, 'handle'), ctx);

    // `kind` is what the handle reported, so it names the action; `id` is the
    // gesture key. Two handles are in flight and the later one is active.
    expect(d.getActiveAction().kind).toBe('rotate');
    expect(d.inFlightCursor()).toBe('alias');
  });

  it('the newest hotkey hold breaks a same-specificity tie', () => {
    const started: string[] = [];
    const pan = ongoing('pan', undefined, () => started.push('pan'));
    const pick = ongoing('pick', undefined, () => started.push('pick'));
    const tools: [string, Tool][] = [
      ['hand', { id: 'hand', eligibility: { focus: true, offhand: 'space' },
        bindings: [{ spec: { kind: 'drag' }, actionId: 'pan' }] } as unknown as Tool],
      ['eyedropper', { id: 'eyedropper', eligibility: { focus: true, offhand: 'alt' },
        bindings: [{ spec: { kind: 'drag' }, actionId: 'pick' }] } as unknown as Tool],
    ];
    const reg = registryOf([pan, pick]);
    const d = createDispatcher({ getAction: (id) => (id === 'pan' ? pan : id === 'pick' ? pick : undefined) });
    // Space held first, then Alt — 'eyedropper' is the engaged tool everywhere
    // else in the kit, so it should be the one the drag routes to.
    d.handleInput(down(1), ctxOf(reg, tools, ['hand', 'eyedropper']));
    expect(started).toEqual(['pick']);
  });
});
