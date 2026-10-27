import { describe, expect, it, vi } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '../actions/invoker';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry, ongoingAction } from './testing/dispatcherStubs';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const down = (x: number, y: number): InputEvent => ({ kind: 'pointerdown', x, y, clientX: x, clientY: y, ...MODS });
const move = (x: number, y: number): InputEvent => ({ kind: 'pointermove', x, y, clientX: x, clientY: y, ...MODS });
const up = (x: number, y: number): InputEvent => ({ kind: 'pointerup', x, y, clientX: x, clientY: y, ...MODS });

/** A drag handle that passes the drag once a move goes past `x`, or never with no `x`. */
function passing(x?: number) {
  const moves: { x: number; y: number }[] = [];
  const handle = {
    onMove: vi.fn((ctx: InvocationCtx) => {
      moves.push({ x: ctx.world.x, y: ctx.world.y });
      return x !== undefined && ctx.world.x > x ? 'pass' as const : undefined;
    }),
    onEnd: vi.fn(),
  } satisfies OngoingHandle;
  return { handle, moves };
}

/** Two drag actions on one spec, `first` ranked ahead by registration order. */
function setup(first: OngoingHandle, second: OngoingHandle) {
  const startFirst = vi.fn().mockReturnValue(first);
  const startSecond = vi.fn().mockReturnValue(second);
  const registry = makeRegistry([
    ongoingAction('first', { kind: 'drag' }, startFirst),
    ongoingAction('second', { kind: 'drag' }, startSecond),
  ]);
  return { dispatcher: createDispatcher(), ctx: makeCtx({ actions: registry }), startFirst, startSecond };
}

describe('handing a drag off', () => {
  it('cancels the passing handle and starts the next candidate at the press, then hands it the move', () => {
    const a = passing(50);
    const b = passing();
    const { dispatcher, ctx, startFirst, startSecond } = setup(a.handle, b.handle);
    dispatcher.handleInput(down(10, 10), ctx);
    dispatcher.handleInput(move(30, 10), ctx);
    expect(startSecond).not.toHaveBeenCalled();
    expect(dispatcher.handleInput(move(60, 12), ctx)).toBe('handled');
    expect(a.handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'cancel');
    expect(startFirst).toHaveBeenCalledOnce();
    expect(startSecond).toHaveBeenCalledOnce();
    expect((startSecond.mock.calls[0]![0] as InvocationCtx).world).toEqual({ x: 10, y: 10 });
    expect(b.moves).toEqual([{ x: 60, y: 12 }]);
    const moved = (b.handle.onMove.mock.calls[0]![0] as InvocationCtx).drag;
    expect(moved?.start).toMatchObject({ x: 10, y: 10 });

    dispatcher.handleInput(move(70, 15), ctx);
    expect(b.moves.at(-1)).toEqual({ x: 70, y: 15 });
    expect(a.moves).toHaveLength(2);
    dispatcher.handleInput(up(70, 15), ctx);
    expect(b.handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
    expect(a.handle.onEnd).toHaveBeenCalledTimes(1);
    expect(dispatcher.inFlight().size).toBe(0);
  });

  it('carries the trail drawn before the hand-off to the taker, and leaves the passer its own copy', () => {
    const a = passing(50);
    const b = passing();
    const { dispatcher, ctx } = setup(a.handle, b.handle);
    dispatcher.handleInput(down(10, 10), ctx);
    dispatcher.handleInput(move(30, 10), ctx);
    dispatcher.handleInput(move(60, 12), ctx);
    const xy = (points: readonly { x: number; y: number }[] | undefined) => points?.map(({ x, y }) => ({ x, y }));
    const handed = (b.handle.onMove.mock.calls[0]![0] as InvocationCtx).drag?.points;
    expect(xy(handed)).toEqual([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 60, y: 12 }]);
    const passerKept = (a.handle.onEnd.mock.calls[0]![0] as InvocationCtx).drag?.points;
    dispatcher.handleInput(move(70, 15), ctx);
    dispatcher.handleInput(up(70, 15), ctx);
    const ended = (b.handle.onEnd.mock.calls[0]![0] as InvocationCtx).drag?.points;
    expect(xy(ended)).toEqual([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 60, y: 12 }, { x: 70, y: 15 }]);
    expect(xy(passerKept)).toEqual([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 60, y: 12 }]);
  });

  it('ends the drag when no other candidate takes it', () => {
    const a = passing(50);
    const registry = makeRegistry([ongoingAction('first', { kind: 'drag' }, vi.fn().mockReturnValue(a.handle))]);
    const ctx = makeCtx({ actions: registry });
    const dispatcher = createDispatcher();
    dispatcher.handleInput(down(10, 10), ctx);
    expect(dispatcher.handleInput(move(60, 10), ctx)).toBe('handled');
    expect(a.handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'cancel');
    expect(dispatcher.inFlight().size).toBe(0);
    expect(dispatcher.handleInput(up(60, 10), ctx)).toBe('unhandled');
  });

  it('never hands a drag back to an action that passed it, so two passing actions end it', () => {
    const a = passing(50);
    const b = passing(0);
    const { dispatcher, ctx, startFirst, startSecond } = setup(a.handle, b.handle);
    dispatcher.handleInput(down(10, 10), ctx);
    dispatcher.handleInput(move(60, 10), ctx);
    expect(startFirst).toHaveBeenCalledOnce();
    expect(startSecond).toHaveBeenCalledOnce();
    expect(b.handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'cancel');
    expect(dispatcher.inFlight().size).toBe(0);
  });

  it('hands off from an action held behind a drag threshold, and to one', () => {
    const a = passing(50);
    const b = passing();
    const registry = makeRegistry([
      { ...ongoingAction('first', { kind: 'drag' }), invoker: { timing: 'ongoing', start: () => a.handle, dragThresholdPx: 5 } },
      { ...ongoingAction('second', { kind: 'drag' }), invoker: { timing: 'ongoing', start: () => b.handle, dragThresholdPx: 5 } },
    ]);
    const ctx = makeCtx({ actions: registry });
    const dispatcher = createDispatcher();
    dispatcher.handleInput(down(10, 10), ctx);
    dispatcher.handleInput(move(30, 10), ctx);
    dispatcher.handleInput(move(60, 10), ctx);
    expect(a.handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'cancel');
    expect(b.moves).toEqual([{ x: 60, y: 10 }]);
  });
});
