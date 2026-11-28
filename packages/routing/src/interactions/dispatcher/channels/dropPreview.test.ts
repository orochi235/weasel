/** The drop preview asks its action again when anything the drop would run with changes, params included. */
import { describe, expect, it, vi } from 'vitest';
import type { Action } from '../../actions/action';
import type { ResolveOnlyResult } from '../dispatcherApi';
import type { InputEvent } from '../matcher';
import { makeCtx, makeRegistry } from '../testing/dispatcherStubs';
import { dropPreview } from './dropPreview';

const event: Extract<InputEvent, { kind: 'drop' }> = {
  kind: 'drop', items: [{ pending: 'file', mime: 'image/png' }] as never, x: 1, y: 2, clientX: 1, clientY: 2,
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
};

function setup() {
  const preview = vi.fn(() => () => {});
  const action: Action = { id: 'drop', label: 'drop', invoker: { timing: 'immediate', run: () => {} }, preview };
  const winner = (params?: Record<string, unknown>): ResolveOnlyResult => ({
    actionId: 'drop', action, binding: { spec: { kind: 'drop' }, actionId: 'drop' }, scope: 'ambient', ownerId: null,
    ...(params ? { params } : {}),
  });
  return { preview, winner, ctx: makeCtx({ actions: makeRegistry([action]) }), shown: dropPreview() };
}

describe('dropPreview', () => {
  it('asks again when the resolved params change under a stationary drag', () => {
    const { preview, winner, ctx, shown } = setup();
    shown.show(event, winner({ fill: 'red' }), ctx);
    shown.show(event, winner({ fill: 'blue' }), ctx);
    expect(preview).toHaveBeenCalledTimes(2);
    expect((preview.mock.calls[1] as unknown[])[1]).toMatchObject({ fill: 'blue' });
  });

  it('asks once for params resolved afresh to equal values', () => {
    const { preview, winner, ctx, shown } = setup();
    shown.show(event, winner({ size: { w: 1 } }), ctx);
    shown.show(event, winner({ size: { w: 1 } }), ctx);
    expect(preview).toHaveBeenCalledTimes(1);
  });
});
