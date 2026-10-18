import { describe, expect, it, vi } from 'vitest';
import type { Action } from '../actions/action';
import type { InvocationCtx } from '../actions/invoker';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry, ongoingAction } from './testing/dispatcherStubs';

type Stage = 'enter' | 'move' | 'drop' | 'leave';

const carry = (stage: Stage, x = 0, over: Record<string, unknown> = {}): InputEvent => ({
  kind: 'carry', stage, pointerId: 1, type: 'lab/part', value: { id: 'a' },
  x, y: 0, clientX: x, clientY: 0,
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
  ...over,
} as InputEvent);

function immediate(id: string, run = vi.fn()): Action {
  return { id, label: id, defaultBinding: { kind: 'carry' }, invoker: { timing: 'immediate', run } };
}

describe('dispatcher — carry', () => {
  it('runs an ongoing action from the carry coming over to its release', () => {
    const handle = { onMove: vi.fn(), onEnd: vi.fn() };
    const start = vi.fn().mockReturnValue(handle);
    const ctx = makeCtx({ actions: makeRegistry([ongoingAction('place', { kind: 'carry' }, start)]) });
    const d = createDispatcher();

    expect(d.handleInput(carry('enter', 1), ctx)).toBe('handled');
    const startCtx = start.mock.calls[0]![0] as InvocationCtx;
    expect(startCtx.world).toEqual({ x: 1, y: 0 });
    expect(startCtx.carry).toEqual({ type: 'lab/part', value: { id: 'a' } });

    d.handleInput(carry('move', 2), ctx);
    expect((handle.onMove.mock.calls[0]![0] as InvocationCtx).world).toEqual({ x: 2, y: 0 });

    expect(d.handleInput(carry('drop', 3), ctx)).toBe('handled');
    expect(handle.onEnd).toHaveBeenCalledWith(expect.objectContaining({ world: { x: 3, y: 0 } }), 'commit');
    expect(d.inFlight().size).toBe(0);
  });

  it('cancels the ongoing action when the carry leaves', () => {
    const handle = { onEnd: vi.fn() };
    const ctx = makeCtx({
      actions: makeRegistry([ongoingAction('place', { kind: 'carry' }, vi.fn().mockReturnValue(handle))]),
    });
    const d = createDispatcher();
    d.handleInput(carry('enter'), ctx);
    d.handleInput(carry('leave'), ctx);
    expect(handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'cancel');
    expect(d.handleInput(carry('drop'), ctx)).toBe('unhandled');
  });

  it('fires an immediate action on the release only, with the payload and the point', () => {
    const run = vi.fn();
    const ctx = makeCtx({ actions: makeRegistry([immediate('place', run)]) });
    const d = createDispatcher();

    expect(d.handleInput(carry('enter'), ctx)).toBe('unhandled');
    d.handleInput(carry('move', 4), ctx);
    expect(run).not.toHaveBeenCalled();

    expect(d.handleInput(carry('drop', 5), ctx)).toBe('handled');
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]![1]).toMatchObject({
      worldX: 5, worldY: 0, clientX: 5, clientY: 0,
      carry: { type: 'lab/part', value: { id: 'a' } },
    });
  });

  it('a carry no binding took over the surface can still be taken on release', () => {
    const run = vi.fn();
    // Declines at enter with an empty handle, so the release falls to the next match.
    const decline = ongoingAction('decline', { kind: 'carry' }, vi.fn().mockReturnValue({}));
    const ctx = makeCtx({ actions: makeRegistry([decline, immediate('place', run)]) });
    const d = createDispatcher();
    d.handleInput(carry('enter'), ctx);
    d.handleInput(carry('drop'), ctx);
    expect(run).toHaveBeenCalledOnce();
  });

  it('keys each pointer’s carry apart', () => {
    const a = { onEnd: vi.fn() };
    const b = { onEnd: vi.fn() };
    const start = vi.fn().mockReturnValueOnce(a).mockReturnValueOnce(b);
    const ctx = makeCtx({ actions: makeRegistry([ongoingAction('place', { kind: 'carry' }, start)]) });
    const d = createDispatcher();
    d.handleInput(carry('enter', 0, { pointerId: 1 }), ctx);
    d.handleInput(carry('enter', 0, { pointerId: 2 }), ctx);
    d.handleInput(carry('drop', 0, { pointerId: 2 }), ctx);
    expect(b.onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
    expect(a.onEnd).not.toHaveBeenCalled();
  });
});
