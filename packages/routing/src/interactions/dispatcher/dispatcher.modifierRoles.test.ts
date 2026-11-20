import { describe, it, expect, vi } from 'vitest';
import type { Action } from '../actions/action';
import type { InvocationCtx } from '../actions/invoker';
import { tuneAction } from '../actions/tuning';
import { roleMods, roleReader } from '../actions/modifierRoles';
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
    for (const apple of [true, false]) {
      const { seen, start } = recorder();
      const ctx = makeCtx({ actions: makeRegistry([holdAction(start)]), apple });
      const d = createDispatcher();
      d.handleInput(pointer('pointerdown'), ctx);
      d.handleInput(pointer('pointermove', { meta: true }), ctx);
      d.handleInput(pointer('pointermove', { ctrl: true }), ctx);
      expect(seen.map((r) => r?.['handle.holdLength'])).toEqual([false, apple, !apple]);
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

  it("lets a drag start with a moved role's new key held, where the binding let its declared key be", () => {
    const pressed = (action: Action, mods: Mods) => {
      const { seen, start } = recorder();
      const withStart = { ...action, invoker: { timing: 'ongoing', start: start as never } } as Action;
      createDispatcher().handleInput(pointer('pointerdown', mods), makeCtx({ actions: makeRegistry([withStart]) }));
      return seen.length > 0;
    };
    const base = holdAction(vi.fn());
    const spec = { kind: 'drag' as const, mods: roleMods(base.modifierRoles!) };
    const tuned = tuneAction({ ...base, defaultBinding: [{ spec }] }, [{ roles: { 'handle.holdAngle': ['alt'] } }]);
    expect(pressed(tuned, { alt: true })).toBe(true);
    const own = { ...base, defaultBinding: [{ spec, opts: { roles: { 'handle.holdAngle': ['alt'] } } }] } as Action;
    expect(pressed(own, { alt: true })).toBe(true);
    // A binding that never let the declared key be held from the press is left as it is.
    const bare = tuneAction(base, [{ roles: { 'handle.holdAngle': ['alt'] } }]);
    expect(pressed(bare, { alt: true })).toBe(false);
  });

  it('reads the default keys where nothing resolved the roles', () => {
    const held = roleReader({ 'mirror.break': { label: 'Break the mirror', keys: ['alt'] } });
    const mods = { alt: true, ctrl: false, meta: false, shift: false };
    expect(held({ modifiers: mods }, 'mirror.break')).toBe(true);
    expect(held({ modifiers: mods, roles: { 'mirror.break': false } }, 'mirror.break')).toBe(false);
  });

  it("hands an immediate action its roles in params, with a binding's rebind and the platform's mod", () => {
    const seen: unknown[] = [];
    const action: Action = {
      id: 'tap',
      label: 'tap',
      defaultBinding: [{ spec: { kind: 'click', mods: { alt: true, meta: true } }, opts: { roles: { 'handle.holdAngle': ['alt'] } } }],
      modifierRoles: holdAction(() => ({})).modifierRoles,
      invoker: { timing: 'immediate', run: (_deps, params) => { seen.push(params?.['roles']); } },
    };
    const ctx = makeCtx({ actions: makeRegistry([action]), apple: true });
    const d = createDispatcher();
    d.handleInput({ ...pointer('pointerdown'), kind: 'click', altKey: true, metaKey: true } as InputEvent, ctx);
    expect(seen).toEqual([{ 'handle.holdAngle': true, 'handle.holdLength': true }]);
  });

  it.each([
    ['key', { spec: { kind: 'key', key: 'h', mods: { shift: true } } }, { kind: 'key', key: 'h' }],
    ['wheel', { spec: { kind: 'wheel', mods: { shift: true } } }, { kind: 'wheel', x: 0, y: 0, clientX: 0, clientY: 0, deltaX: 0, deltaY: 1 }],
  ] as const)('hands an immediate action bound to a %s its roles and view in params', (_kind, binding, event) => {
    const seen: unknown[] = [];
    const action: Action = {
      id: 'tap',
      label: 'tap',
      defaultBinding: [binding as never],
      modifierRoles: holdAction(() => ({})).modifierRoles,
      invoker: { timing: 'immediate', run: (_deps, params) => { seen.push(params); } },
    };
    const ctx = makeCtx({ actions: makeRegistry([action]), viewId: 'left' });
    createDispatcher().handleInput({ ...event, altKey: false, ctrlKey: false, metaKey: false, shiftKey: true } as InputEvent, ctx);
    expect(seen).toEqual([expect.objectContaining({
      roles: { 'handle.holdAngle': true, 'handle.holdLength': false }, viewId: 'left',
    })]);
  });
});
