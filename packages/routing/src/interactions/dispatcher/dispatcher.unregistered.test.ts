/** A binding to an action nobody registered is reported once, not on every event that reaches it. */
import { describe, expect, it, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { Contribution } from '../../contributions/types';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry } from './testing/dispatcherStubs';

const hoverAt = (x: number): InputEvent => ({
  kind: 'hover', x, y: 0, clientX: x, clientY: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
});

describe('a binding to an unregistered action', () => {
  it('warns once for a hover binding however many moves reach it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const entry: Contribution = {
        id: 'gestures', eligibility: { always: true },
        bindings: [{ spec: { kind: 'hover' }, actionId: 'unregistered.hover' }],
      };
      const ctx = makeCtx({ actions: makeRegistry([]), entriesById: new Map([['gestures', entry]]) });
      const d = createDispatcher();
      for (let x = 0; x < 5; x++) d.handleInput(hoverAt(x), ctx);
      expect(warn.mock.calls.filter(([m]) => String(m).includes('unregistered.hover'))).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });
});
