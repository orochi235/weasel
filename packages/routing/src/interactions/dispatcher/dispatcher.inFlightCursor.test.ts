import { describe, expect, it, vi } from 'vitest';
import type { Action } from '../actions/action';
import type { OngoingInvoker } from '../actions/invoker';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry, ongoingAction } from './testing/dispatcherStubs';

const at = (kind: 'pointerdown' | 'pointermove' | 'pointerup', clientX: number): InputEvent => ({
  kind, x: clientX, y: 0, clientX, clientY: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
} as InputEvent);

function run(action: Action) {
  const dispatcher = createDispatcher();
  const ctx = makeCtx({ actions: makeRegistry([action]) });
  return { dispatcher, send: (e: InputEvent) => dispatcher.handleInput(e, ctx) };
}

describe('the cursor of a gesture in flight', () => {
  it("resolves the action's cursor with the params of the binding that opened it", () => {
    const action = ongoingAction('resize', [{ spec: { kind: 'drag' }, opts: { params: { axis: 'x' } } }],
      vi.fn(() => ({ onMove: vi.fn() })));
    action.cursor = (p) => (p?.axis === 'x' ? 'ew-resize' : 'ns-resize');
    const { dispatcher, send } = run(action);
    send(at('pointerdown', 100));
    expect(dispatcher.inFlightCursor()).toBe('ew-resize');
  });

  it('is not shown for a drag held by its threshold until the action starts', () => {
    const action = ongoingAction('grab', { kind: 'drag' }, vi.fn(() => ({ onMove: vi.fn() })));
    (action.invoker as OngoingInvoker).dragThresholdPx = 8;
    action.activeCursor = 'grabbing';
    const { dispatcher, send } = run(action);
    send(at('pointerdown', 100));
    expect(dispatcher.inFlightCursor()).toBeNull();
    send(at('pointermove', 120));
    expect(dispatcher.inFlightCursor()).toBe('grabbing');
  });
});
