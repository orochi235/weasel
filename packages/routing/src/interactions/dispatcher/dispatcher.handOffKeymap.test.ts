import { describe, expect, it, vi } from 'vitest';
import type { InvocationCtx } from '../actions/invoker';
import type { Contribution } from '../../contributions/types';
import { createKeymapStack } from '../../keymaps/keymapStack';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry, ongoingAction } from './testing/dispatcherStubs';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const at = (kind: 'pointerdown' | 'pointermove', x: number): InputEvent =>
  ({ kind, x, y: 0, clientX: x, clientY: 0, ...MODS } as InputEvent);

describe('a drag handed off with a keymap held open', () => {
  it("is offered only the candidates of the keymap pass its press ran under", () => {
    // The keymap's drag declines the press, so it goes on to every binding but the keymap's.
    const startInKeymap = vi.fn().mockReturnValue({});
    const passes = { onMove: vi.fn((ctx: InvocationCtx) => (ctx.world.x > 50 ? 'pass' as const : undefined)), onEnd: vi.fn() };
    const takes = { onMove: vi.fn(), onEnd: vi.fn() };
    const startTakes = vi.fn().mockReturnValue(takes);
    const keymap: Contribution<never> = {
      id: 'loupe', eligibility: { keymap: true }, bindings: [{ spec: { kind: 'drag' }, actionId: 'inKeymap' }],
    };
    const stack = createKeymapStack();
    stack.push('loupe', 'Loupe', { heldBy: 'Space' });
    const ctx = makeCtx({
      actions: makeRegistry([
        ongoingAction('inKeymap', undefined, startInKeymap),
        ongoingAction('passes', { kind: 'drag' }, vi.fn().mockReturnValue(passes)),
        ongoingAction('takes', { kind: 'drag' }, startTakes),
      ]),
      entriesById: new Map([['loupe', keymap]]),
      keymaps: stack,
    });
    const dispatcher = createDispatcher();
    dispatcher.handleInput(at('pointerdown', 10), ctx);
    expect(startInKeymap).toHaveBeenCalledOnce();
    dispatcher.handleInput(at('pointermove', 60), ctx);
    expect(startTakes).toHaveBeenCalledOnce();
    expect(startInKeymap).toHaveBeenCalledOnce();
  });
});
