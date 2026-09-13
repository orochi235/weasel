/**
 * `ctx.drag.points` is handed to `onEnd` as well as `onMove`, so an action that
 * only needs the finished path — a lasso that selects on release, a stroke
 * committed in one go — is entitled to read it there. The accumulation used to
 * sit inside the `onMove` guard, so such an action saw only the press point and
 * silently committed a one-vertex path; adding a no-op `onMove` "fixed" it,
 * which is the tell.
 */
import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry } from '../actions/registry';
import type { Action } from '../actions/action';
import type { DepRegistry } from '../actions/depRegistry';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';
import type { InvocationCtx } from '../actions/invoker';

function makeCtx(actions: ActionsRegistry, tool: Tool): DispatcherContext {
  const depRegistry: DepRegistry = {
    register: vi.fn().mockReturnValue(() => {}),
    get: vi.fn() as DepRegistry['get'],
  };
  return {
    depRegistry,
    actions,
    activeToolId: 'lasso',
    hotkeyStack: [],
    toolsById: new Map([['lasso', tool]]),
    isMac: false,
  };
}

/** An ongoing action that reads the trail only at the end. `onMove` is absent
 *  on purpose — supplying one is what used to make this pass. */
function endOnlyAction(onEnd: (ctx: InvocationCtx) => void): Action {
  return {
    id: 'lassoSelect',
    label: 'lassoSelect',
    invoker: { timing: 'ongoing', start: () => ({ onEnd }) },
  };
}

const tool = {
  id: 'lasso',
  eligibility: { focus: true },
  bindings: [{ spec: { kind: 'drag' }, actionId: 'lassoSelect' }],
} as unknown as Tool;

function pointer(kind: string, x: number, y: number): InputEvent {
  return {
    kind, x, y, clientX: x, clientY: y,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
  } as unknown as InputEvent;
}

describe('drag.points reaches an action with no onMove', () => {
  it('accumulates every pointermove vertex, not just the press point', () => {
    const seen: InvocationCtx[] = [];
    const action = endOnlyAction((ctx) => { seen.push(ctx); });
    const registry = {
      register: vi.fn(), unregister: vi.fn(), mute: vi.fn(), subscribe: vi.fn(),
      trigger: vi.fn(), begin: vi.fn(), setDispatcher: vi.fn(), setDepRegistry: vi.fn(),
      list: () => [action],
    } as unknown as ActionsRegistry;
    const d = createDispatcher({ getAction: (id) => (id === 'lassoSelect' ? action : undefined) });
    const ctx = makeCtx(registry, tool);

    d.handleInput(pointer('pointerdown', 0, 0), ctx);
    d.handleInput(pointer('pointermove', 10, 0), ctx);
    d.handleInput(pointer('pointermove', 10, 10), ctx);
    d.handleInput(pointer('pointerup', 10, 10), ctx);

    expect(seen).toHaveLength(1);
    expect(seen[0]!.drag?.points).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 },
    ]);
  });
});
