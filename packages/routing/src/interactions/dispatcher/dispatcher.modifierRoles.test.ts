import { describe, it, expect, vi } from 'vitest';
import type { Action } from '../actions/action';
import type { InvocationCtx } from '../actions/invoker';
import { tuneAction } from '../actions/tuning';
import { roleReader } from '../actions/modifierRoles';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeRegistry, makeCtx } from './testing/dispatcherStubs';

type Mods = { alt?: boolean; ctrl?: boolean; meta?: boolean; shift?: boolean };

const pointer = (kind: 'pointerdown' | 'pointermove' | 'pointerup', m: Mods = {}): InputEvent => ({
  kind, x: 0, y: 0,
  altKey: !!m.alt, ctrlKey: !!m.ctrl, metaKey: !!m.meta, shiftKey: !!m.shift,
} as InputEvent);

function recorder() {
  const seen: Array<InvocationCtx['roles']> = [];
  const handle = {
    onMove: vi.fn((c: InvocationCtx) => { seen.push(c.roles); }),
    onEnd: vi.fn((c: InvocationCtx) => { seen.push(c.roles); }),
  };
  const start = vi.fn((c: InvocationCtx) => { seen.push(c.roles); return handle; });
  return { seen, start };
}

function holdAction(start: (c: InvocationCtx) => unknown, binding?: Action['defaultBinding']): Action {
  return {
    id: 'hold',
    label: 'hold',
    defaultBinding: binding ?? { kind: 'drag' },
    modifierRoles: {
      'handle.holdAngle': { label: 'Hold the angle', keys: ['shift'] },
      'handle.holdLength': { label: 'Hold the length', keys: ['mod'] },
    },
    invoker: { timing: 'ongoing', start: start as never },
  };
}

describe('modifier roles', () => {
  it('resolves each declared role into the ctx on the press, every move, and the release', () => {
    const { seen, start } = recorder();
    const ctx = makeCtx({ actions: makeRegistry([holdAction(start)]) });
    const d = createDispatcher();
    d.handleInput(pointer('pointerdown'), ctx);
    d.handleInput(pointer('pointermove', { shift: true }), ctx);
    d.handleInput(pointer('pointerup'), ctx);
    expect(seen).toEqual([
      { 'handle.holdAngle': false, 'handle.holdLength': false },
      { 'handle.holdAngle': true, 'handle.holdLength': false },
      { 'handle.holdAngle': false, 'handle.holdLength': false },
    ]);
  });

  it('reads mod as Cmd on a Mac and Ctrl elsewhere', () => {
    for (const isMac of [true, false]) {
      const { seen, start } = recorder();
      const ctx = makeCtx({ actions: makeRegistry([holdAction(start)]), isMac });
      const d = createDispatcher();
      d.handleInput(pointer('pointerdown'), ctx);
      d.handleInput(pointer('pointermove', { meta: true }), ctx);
      d.handleInput(pointer('pointermove', { ctrl: true }), ctx);
      expect(seen.map((r) => r?.['handle.holdLength'])).toEqual([false, isMac, !isMac]);
    }
  });

  it("lets a binding's opts.roles rebind a role", () => {
    const { seen, start } = recorder();
    const action = holdAction(start, [{ spec: { kind: 'drag' }, opts: { roles: { 'handle.holdAngle': ['alt'] } } }]);
    const ctx = makeCtx({ actions: makeRegistry([action]) });
    const d = createDispatcher();
    d.handleInput(pointer('pointerdown'), ctx);
    d.handleInput(pointer('pointermove', { shift: true }), ctx);
    d.handleInput(pointer('pointermove', { alt: true }), ctx);
    expect(seen.map((r) => r?.['handle.holdAngle'])).toEqual([false, false, true]);
  });

  it('leaves roles off the ctx of an action that declares none', () => {
    const { seen, start } = recorder();
    const action: Action = { id: 'plain', label: 'plain', defaultBinding: { kind: 'drag' }, invoker: { timing: 'ongoing', start: start as never } };
    const ctx = makeCtx({ actions: makeRegistry([action]) });
    const d = createDispatcher();
    d.handleInput(pointer('pointerdown', {}), ctx);
    d.handleInput(pointer('pointermove', { shift: true }), ctx);
    expect(seen).toEqual([undefined, undefined]);
  });

  it("lets a tuning rebind a role, under a binding's own rebind", () => {
    const { seen, start } = recorder();
    const tuned = tuneAction(holdAction(start), [{ roles: { 'handle.holdAngle': ['ctrl'] } }]);
    expect(tuned.modifierRoles?.['handle.holdAngle'].keys).toEqual(['ctrl']);
    const ctx = makeCtx({ actions: makeRegistry([tuned]) });
    const d = createDispatcher();
    d.handleInput(pointer('pointerdown'), ctx);
    d.handleInput(pointer('pointermove', { shift: true }), ctx);
    d.handleInput(pointer('pointermove', { ctrl: true }), ctx);
    expect(seen.map((r) => r?.['handle.holdAngle'])).toEqual([false, false, true]);
  });

  it('reads the default keys where nothing resolved the roles', () => {
    const held = roleReader({ 'mirror.break': { label: 'Break the mirror', keys: ['alt'] } });
    const mods = { alt: true, ctrl: false, meta: false, shift: false };
    expect(held({ modifiers: mods }, 'mirror.break')).toBe(true);
    expect(held({ modifiers: mods, roles: { 'mirror.break': false } }, 'mirror.break')).toBe(false);
  });
});
