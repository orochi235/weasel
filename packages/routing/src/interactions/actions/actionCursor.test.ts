import { describe, expect, it, vi } from 'vitest';
import { actionCursor, type Action } from './action';
import { tuneAction } from './tuning';
import { createDispatcher } from '../dispatcher/dispatcher';
import type { InputEvent } from '../dispatcher/matcher';
import { makeCtx, makeRegistry, ongoingAction } from '../dispatcher/testing/dispatcherStubs';

/** An action whose hover cursor is a ring as wide as its `size` param. */
function ring(): Action {
  return {
    ...ongoingAction('brush', { kind: 'drag' }, vi.fn()),
    cursor: (params) => ({ glyph: 'brush', size: (params?.size as number | undefined) ?? 10 }),
  };
}

const press: InputEvent = {
  kind: 'pointerdown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, bodyTarget: 'empty',
};

describe('actionCursor', () => {
  it('reads a fixed cursor as it is, and asks a function with the params', () => {
    expect(actionCursor({ cursor: 'grab' }, { size: 3 })).toBe('grab');
    expect(actionCursor(ring(), { size: 3 })).toEqual({ glyph: 'brush', size: 3 });
    expect(actionCursor(ring())).toEqual({ glyph: 'brush', size: 10 });
    expect(actionCursor(undefined)).toBeUndefined();
  });

  it("hands the cursor a tuning's params beneath the call's", () => {
    let size = 24;
    const tuned = tuneAction(ring(), [{ params: () => ({ size }) }]);
    expect(actionCursor(tuned)).toEqual({ glyph: 'brush', size: 24 });
    size = 40;
    expect(actionCursor(tuned)).toEqual({ glyph: 'brush', size: 40 });
    expect(actionCursor(tuned, { size: 5 })).toEqual({ glyph: 'brush', size: 5 });
  });

  it('is handed the params of the binding a prediction picks', () => {
    const action: Action = {
      ...ring(),
      defaultBinding: [{ spec: { kind: 'drag' }, opts: { params: { size: 18 } } }],
    };
    const result = createDispatcher().resolveOnly(press, makeCtx({ actions: makeRegistry([action]) }));
    expect(result?.params).toEqual({ size: 18 });
    expect(actionCursor(result?.action, result?.params)).toEqual({ glyph: 'brush', size: 18 });
  });
});
