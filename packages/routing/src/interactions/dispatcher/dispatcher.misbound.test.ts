/** An ongoing action bound to a hover or press spec is reported once, not on every event that reaches it. */
import { describe, expect, it, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { Action } from '../actions/action';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry } from './testing/dispatcherStubs';

const ongoing = (id: string, defaultBinding: Action['defaultBinding']): Action => ({
  id, label: id, defaultBinding,
  invoker: { timing: 'ongoing', start: () => ({ onMove: () => {}, onEnd: () => {} }) },
});

const hoverAt = (x: number): InputEvent => ({
  kind: 'hover', x, y: 0, clientX: x, clientY: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
});

describe('an ongoing action on a spec it cannot run on', () => {
  it('logs one error for a hover binding however many moves reach it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const d = createDispatcher();
      const ctx = makeCtx({ actions: makeRegistry([ongoing('misbound.hover', { kind: 'hover' })]) });
      for (let x = 0; x < 5; x++) d.handleInput(hoverAt(x), ctx);
      expect(error.mock.calls.filter(([m]) => String(m).includes('misbound.hover'))).toHaveLength(1);
    } finally {
      error.mockRestore();
    }
  });
});
