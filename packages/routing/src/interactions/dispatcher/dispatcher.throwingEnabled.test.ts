/** A binding whose action's `enabled` throws declines, as `evaluateEnabled` reads it everywhere else. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry, ongoingAction } from './testing/dispatcherStubs';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const down: InputEvent = { kind: 'pointerdown', x: 0, y: 0, clientX: 0, clientY: 0, ...MODS };

afterEach(() => { vi.restoreAllMocks(); });

describe('an action whose enabled throws', () => {
  it('declines the gesture and leaves it to the next candidate, with one dev warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = ongoingAction('broken', { kind: 'drag' });
    broken.enabled = () => { throw new Error('enabled broke'); };
    const startNext = vi.fn().mockReturnValue({ onMove: () => {}, onEnd: () => {} });
    const ctx = makeCtx({ actions: makeRegistry([broken, ongoingAction('next', { kind: 'drag' }, startNext)]) });
    const dispatcher = createDispatcher();

    expect(() => dispatcher.handleInput(down, ctx)).not.toThrow();
    expect(startNext).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('enabled() for action "broken" threw'), expect.any(Error));
  });
});
