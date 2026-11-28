import { describe, expect, it, vi } from 'vitest';
import { key } from '@weasel-js/gestures';
import type { Action } from '../actions/action';
import type { Contribution } from '../../contributions/types';
import { createKeymapStack } from '../../keymaps/keymapStack';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry } from './testing/dispatcherStubs';

const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const press = (k: string): InputEvent => ({ kind: 'key', key: k, ...mods });

function gated(id: string, spec: Action['defaultBinding'], enabled: () => true | string): Action & { enabled: ReturnType<typeof vi.fn> } {
  return { id, label: id, defaultBinding: spec, invoker: { timing: 'immediate', run: vi.fn() }, enabled: vi.fn(enabled) };
}

function setup(actions: Action[]) {
  const keymap: Contribution<never> = {
    id: 'loupe', eligibility: { keymap: true }, bindings: [{ spec: key('2'), actionId: 'inside' }],
  };
  const stack = createKeymapStack();
  stack.push('loupe', 'Loupe');
  const ctx = makeCtx({ actions: makeRegistry(actions), entriesById: new Map([['loupe', keymap]]), keymaps: stack });
  return { dispatcher: createDispatcher(), ctx };
}

describe('prediction with a keymap open', () => {
  it("asks each gate as often as the dispatch it predicts", () => {
    const inside = gated('inside', undefined, () => true);
    const { dispatcher, ctx } = setup([inside]);
    expect(dispatcher.resolveOnly(press('2'), ctx)?.actionId).toBe('inside');
    expect(inside.enabled).toHaveBeenCalledOnce();
  });

  it('lists the candidates of an input the keymap passes on, though none of them fires', () => {
    const tabber = gated('tabber', key('Tab'), () => 'busy');
    const { dispatcher, ctx } = setup([gated('inside', undefined, () => true), tabber]);
    expect(dispatcher.resolveAll(press('Tab'), ctx).map((c) => [c.actionId, c.verdict]))
      .toEqual([['tabber', { kind: 'disabled', reason: 'busy' }]]);
  });

  it('lists none for an input the keymap withholds', () => {
    const outside = gated('outside', key('3'), () => 'busy');
    const { dispatcher, ctx } = setup([gated('inside', undefined, () => true), outside]);
    expect(dispatcher.resolveAll(press('3'), ctx)).toEqual([]);
  });
});
