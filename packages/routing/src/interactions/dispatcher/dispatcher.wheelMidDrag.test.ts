import { describe, expect, it, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry, ongoingAction } from './testing/dispatcherStubs';

const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const down: InputEvent = { kind: 'pointerdown', x: 0, y: 0, ...mods } as InputEvent;
const wheel: InputEvent = { kind: 'wheel', deltaX: 0, deltaY: -40, clientX: 0, clientY: 0, ...mods };

function setup(onWheel: (() => boolean | void) | undefined) {
  const zoom = vi.fn();
  const handle = { onMove: vi.fn(), onEnd: vi.fn(), ...(onWheel ? { onWheel: vi.fn(onWheel) } : {}) };
  const drag = ongoingAction('drag', { kind: 'drag' }, vi.fn().mockReturnValue(handle));
  const zoomAction = {
    id: 'zoom', label: 'zoom',
    defaultBinding: { kind: 'wheel' as const },
    invoker: { timing: 'immediate' as const, run: zoom },
  };
  const ctx = makeCtx({ actions: makeRegistry([drag, zoomAction]) });
  const dispatcher = createDispatcher();
  dispatcher.handleInput(down, ctx);
  return { dispatcher, ctx, handle, zoom };
}

describe('a wheel while a gesture is in flight', () => {
  it('goes to the gesture first, and no further when it claims it', () => {
    const { dispatcher, ctx, handle, zoom } = setup(() => true);
    expect(dispatcher.handleInput(wheel, ctx)).toBe('handled');
    expect(handle.onWheel).toHaveBeenCalledWith(expect.objectContaining({ wheel: { deltaX: 0, deltaY: -40, deltaZ: 0 } }));
    expect(zoom).not.toHaveBeenCalled();
  });

  it('reaches the wheel bindings when the gesture lets it through', () => {
    const { dispatcher, ctx, handle, zoom } = setup(() => false);
    dispatcher.handleInput(wheel, ctx);
    expect(handle.onWheel).toHaveBeenCalledOnce();
    expect(zoom).toHaveBeenCalledOnce();
  });

  it('reaches the wheel bindings when the gesture takes no wheel', () => {
    const { dispatcher, ctx, zoom } = setup(undefined);
    dispatcher.handleInput(wheel, ctx);
    expect(zoom).toHaveBeenCalledOnce();
  });
});
