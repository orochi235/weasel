import { describe, expect, it, vi } from 'vitest';
import type { InvocationCtx } from '../actions/invoker';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry, ongoingAction } from './testing/dispatcherStubs';

const at = (kind: 'pointerdown' | 'pointermove' | 'pointerup', clientX: number, clientY: number): InputEvent => ({
  kind, x: clientX, y: clientY, clientX, clientY, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
} as InputEvent);

function drag(toLocal?: (cx: number, cy: number) => { x: number; y: number }) {
  const onMove = vi.fn((_ctx: InvocationCtx) => {});
  const action = ongoingAction('probe', { kind: 'drag' }, vi.fn(() => ({ onMove })));
  const dispatcher = createDispatcher();
  const ctx = makeCtx({ actions: makeRegistry([action]), ...(toLocal ? { toLocal } : {}) });
  dispatcher.handleInput(at('pointerdown', 100, 100), ctx);
  dispatcher.handleInput(at('pointermove', 140, 120), ctx);
  return onMove.mock.calls[0]![0].drag?.screenDelta;
}

describe("a drag's screenDelta", () => {
  it('is the client difference when the host maps nothing', () => {
    expect(drag()).toEqual({ x: 40, y: 20 });
  });

  it("is measured in the host's canvas-local pixels, so a scaled host pans with the pointer", () => {
    // Drawn at twice size: one canvas pixel per two client pixels.
    expect(drag((cx, cy) => ({ x: (cx - 10) / 2, y: (cy - 10) / 2 }))).toEqual({ x: 20, y: 10 });
  });
});
