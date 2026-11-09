/** An ongoing handle in flight always has something that ends it. */
import { describe, expect, it, vi } from 'vitest';
import type { InvocationCtx } from '../actions/invoker';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry, ongoingAction } from './testing/dispatcherStubs';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const keyX: InputEvent = { kind: 'key', key: 'x', ...MODS } as InputEvent;
const press: InputEvent = { kind: 'pointerdown', x: 0, y: 0, clientX: 0, clientY: 0, ...MODS } as InputEvent;

describe('an ongoing action bound to a key, which no later input continues', () => {
  it('commits the handle a second firing replaces, so each start has its end', () => {
    const log: string[] = [];
    let n = 0;
    const start = vi.fn((_ctx: InvocationCtx) => {
      const id = ++n;
      log.push(`start:${id}`);
      return { onEnd: (_c: InvocationCtx, reason: string) => { log.push(`end:${id}:${reason}`); } };
    });
    const action = ongoingAction('x', { kind: 'key', key: 'x' }, start);
    const d = createDispatcher();
    const ctx = makeCtx({ actions: makeRegistry([action]) });
    d.handleInput(keyX, ctx);
    d.handleInput(keyX, ctx);
    expect(log).toEqual(['start:1', 'end:1:commit', 'start:2']);
    expect(d.inFlight().size).toBe(1);
    d.cancelAll('cancel');
    expect(log).toEqual(['start:1', 'end:1:commit', 'start:2', 'end:2:cancel']);
  });
});

describe('an ongoing action whose start tears the dispatcher down', () => {
  it('ends the handle it returned rather than leaving it in flight', () => {
    const onEnd = vi.fn();
    let d!: ReturnType<typeof createDispatcher>;
    const start = vi.fn(() => {
      d.cancelAll('cancel');
      return { onMove: () => {}, onEnd };
    });
    const action = ongoingAction('drag', { kind: 'drag' }, start);
    d = createDispatcher();
    expect(d.handleInput(press, makeCtx({ actions: makeRegistry([action]) }))).toBe('handled');
    expect(d.inFlight().size).toBe(0);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), 'cancel');
  });
});
