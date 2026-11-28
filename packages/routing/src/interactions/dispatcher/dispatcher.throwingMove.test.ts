import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry, ongoingAction } from './testing/dispatcherStubs';

const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const down: InputEvent = { kind: 'pointerdown', x: 0, y: 0, ...mods } as InputEvent;
const move: InputEvent = { kind: 'pointermove', x: 5, y: 0, ...mods } as InputEvent;
const up: InputEvent = { kind: 'pointerup', x: 5, y: 0, ...mods } as InputEvent;
const wheel: InputEvent = { kind: 'wheel', deltaX: 0, deltaY: -40, clientX: 0, clientY: 0, ...mods };

function setup() {
  const zoom = vi.fn();
  const handle = {
    onMove: vi.fn(() => { throw new Error('move failed'); }),
    onWheel: vi.fn((): boolean => { throw new Error('wheel failed'); }),
    onEnd: vi.fn(),
  };
  const drag = ongoingAction('drag', { kind: 'drag' }, vi.fn().mockReturnValue(handle));
  const zoomAction = {
    id: 'zoom', label: 'zoom',
    defaultBinding: { kind: 'wheel' as const },
    invoker: { timing: 'immediate' as const, run: zoom },
  };
  const ctx = makeCtx({ actions: makeRegistry([drag, zoomAction]) });
  const dispatcher = createDispatcher();
  dispatcher.handleInput(down, ctx);
  return { send: (e: InputEvent) => dispatcher.handleInput(e, ctx), handle, zoom };
}

describe('an in-flight handle that throws', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('on a move is logged, and the drag still ends on its release', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { send, handle } = setup();
    expect(send(move)).toBe('handled');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('onMove'), expect.any(Error));
    send(up);
    expect(handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
  });

  it('on a wheel is logged, and the wheel goes on to its bindings', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { send, zoom } = setup();
    expect(send(wheel)).toBe('handled');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('onWheel'), expect.any(Error));
    expect(zoom).toHaveBeenCalledOnce();
  });
});
