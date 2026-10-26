import { describe, expect, it, vi } from 'vitest';
import type { BindingOpts, InvocationCtx, OngoingInvoker } from '../actions/invoker';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry, ongoingAction } from './testing/dispatcherStubs';

const at = (kind: 'pointerdown' | 'pointermove' | 'pointerup', clientX: number): InputEvent => ({
  kind, x: clientX, y: 0, clientX, clientY: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
} as InputEvent);

/** A drag action declaring `actionPx`, bound with `bindingOpts`, run through a dispatcher. */
function setup(actionPx: number | undefined, bindingOpts?: BindingOpts) {
  const handle = { kind: 'probe', onMove: vi.fn(), onEnd: vi.fn(), overlay: vi.fn(() => null) };
  const start = vi.fn((_ctx: InvocationCtx) => handle);
  const action = ongoingAction('probe', bindingOpts ? [{ spec: { kind: 'drag' }, opts: bindingOpts }] : { kind: 'drag' }, start);
  if (actionPx !== undefined) (action.invoker as OngoingInvoker).dragThresholdPx = actionPx;
  const dispatcher = createDispatcher();
  const ctx = makeCtx({ actions: makeRegistry([action]) });
  return { handle, start, send: (e: InputEvent) => dispatcher.handleInput(e, ctx), dispatcher };
}

describe("an action's drag threshold", () => {
  it('holds start until the drag travels that far, then starts it from the press and feeds it the move', () => {
    const { handle, start, send } = setup(8);
    expect(send(at('pointerdown', 100))).toBe('handled');
    send(at('pointermove', 105));
    expect(start).not.toHaveBeenCalled();
    send(at('pointermove', 109));
    expect(start).toHaveBeenCalledOnce();
    expect(start.mock.calls[0]![0].world).toEqual({ x: 100, y: 0 });
    expect(handle.onMove).toHaveBeenCalledOnce();
    expect(handle.onMove.mock.calls[0]![0].world).toEqual({ x: 109, y: 0 });
    send(at('pointerup', 109));
    expect(handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
  });

  it('ends a drag released short of it without ever starting the action', () => {
    const { handle, start, send, dispatcher } = setup(8);
    send(at('pointerdown', 100));
    send(at('pointermove', 106));
    expect(dispatcher.inFlight().size).toBe(1);
    send(at('pointerup', 106));
    expect(start).not.toHaveBeenCalled();
    expect(handle.onEnd).not.toHaveBeenCalled();
    expect(dispatcher.inFlight().size).toBe(0);
  });

  it("answers nothing of the action's handle until it starts", () => {
    const { send, dispatcher } = setup(8);
    send(at('pointerdown', 100));
    const held = [...dispatcher.inFlight().values()][0]!;
    expect(held.overlay).toBeUndefined();
    expect('overlay' in held).toBe(false);
    send(at('pointermove', 120));
    expect(held.kind).toBe('probe');
    expect('overlay' in held).toBe(true);
  });

  it("takes a binding's threshold over the action's", () => {
    const { start, send } = setup(8, { dragThresholdPx: 20 });
    send(at('pointerdown', 100));
    send(at('pointermove', 110));
    expect(start).not.toHaveBeenCalled();
    send(at('pointermove', 120));
    expect(start).toHaveBeenCalledOnce();
  });

  it('starts at once when nothing declares one', () => {
    const { start, send } = setup(undefined);
    send(at('pointerdown', 100));
    expect(start).toHaveBeenCalledOnce();
  });
});
