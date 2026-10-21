import { describe, it, expect, vi, beforeEach } from 'vitest';
import { held, key } from '@weasel-js/gestures';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import { makeCtx, makeRegistry } from './testing/dispatcherStubs';
import type { InputEvent } from './matcher';
import type { Action } from '../actions/action';
import type { Contribution } from '../../contributions/types';
import { createKeymapStack, type KeymapStack, type KeymapUnbound } from '../../keymaps/keymapStack';

const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const down = (k: string): InputEvent => ({ kind: 'key', key: k, ...mods });
const heldDown = (k: string): InputEvent => ({ kind: 'key-held', key: k, phase: 'down', ...mods });
const click: InputEvent = { kind: 'click', x: 0, y: 0, ...mods };

function act(id: string): Action & { run: ReturnType<typeof vi.fn> } {
  const run = vi.fn();
  return { id, label: id, invoker: { timing: 'immediate', run }, run };
}

describe('the dispatcher with a keymap open', () => {
  let stack: KeymapStack;
  let inside: ReturnType<typeof act>;
  let insideHeld: ReturnType<typeof act>;
  let outside: ReturnType<typeof act>;
  let outsideHotkey: ReturnType<typeof act>;
  let outsideHeld: ReturnType<typeof act>;
  let outsideEscape: ReturnType<typeof act>;
  let outsideClick: ReturnType<typeof act>;

  const keymap = (unbound?: KeymapUnbound): Contribution<never> => ({
    id: 'loupe',
    eligibility: { keymap: unbound ? { unbound } : true },
    bindings: [
      { spec: key('2'), actionId: 'inside' },
      { spec: held('H'), actionId: 'insideHeld' },
    ],
  });

  const ctxFor = (over: Partial<Omit<DispatcherContext, 'actions'>> = {}, unbound?: KeymapUnbound): DispatcherContext => {
    outside.defaultBinding = [key('3'), key('2')];
    outsideHotkey.defaultBinding = key('2');
    outsideHotkey.scope = 'hotkey';
    outsideHeld.defaultBinding = held('3');
    outsideEscape.defaultBinding = key('Escape');
    outsideClick.defaultBinding = { kind: 'click' };
    return makeCtx({
      actions: makeRegistry([inside, insideHeld, outside, outsideHotkey, outsideHeld, outsideEscape, outsideClick]),
      entriesById: new Map([['loupe', keymap(unbound)]]),
      keymaps: stack,
      ...over,
    });
  };

  /** One raw input, as the keyboard channel sends it. */
  const keystroke = (d: ReturnType<typeof createDispatcher>, ctx: DispatcherContext, k: string) =>
    stack.batch(() => [d.handleInput(down(k), ctx), d.handleInput(heldDown(k), ctx)]);

  beforeEach(() => {
    stack = createKeymapStack();
    inside = act('inside');
    insideHeld = act('insideHeld');
    outside = act('outside');
    outsideHotkey = act('outsideHotkey');
    outsideHeld = act('outsideHeld');
    outsideEscape = act('outsideEscape');
    outsideClick = act('outsideClick');
  });

  it('is dead while closed', () => {
    const d = createDispatcher();
    keystroke(d, ctxFor(), '2');
    expect(inside.run).not.toHaveBeenCalled();
    expect(outsideHotkey.run).toHaveBeenCalledOnce();
  });

  it('takes a key it binds ahead of a hotkey-tier binding outside it, and closes', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    keystroke(d, ctxFor(), '2');
    expect(inside.run).toHaveBeenCalledOnce();
    expect(outsideHotkey.run).not.toHaveBeenCalled();
    expect(stack.open()).toEqual([]);
  });

  it('swallows a key it does not bind, and stays open, when modal', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    expect(keystroke(d, ctxFor(), '3')).toEqual(['handled', 'handled']);
    expect(outside.run).not.toHaveBeenCalled();
    expect(outsideHeld.run).not.toHaveBeenCalled();
    expect(stack.open().map((k) => k.id)).toEqual(['loupe']);
  });

  it('lets a key it does not bind through, and closes, when cascading', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    keystroke(d, ctxFor({ leaderUnbound: 'cascade' }), '3');
    expect(outside.run).toHaveBeenCalledOnce();
    expect(stack.open()).toEqual([]);
  });

  it("follows the keymap's own setting over the kit's", () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    keystroke(d, ctxFor({ leaderUnbound: 'modal' }, 'cascade'), '3');
    expect(outside.run).toHaveBeenCalledOnce();
  });

  it('never hands the key-held twin of a key it took to a binding outside', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    const ctx = ctxFor();
    outsideHeld.defaultBinding = held('2');
    keystroke(d, makeCtx({ ...ctx, actions: makeRegistry([inside, outsideHeld]) }), '2');
    expect(inside.run).toHaveBeenCalledOnce();
    expect(outsideHeld.run).not.toHaveBeenCalled();
  });

  it('leaves a key it binds only in its held form to the held twin, even when cascading', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    const ctx = ctxFor({ leaderUnbound: 'cascade' });
    outside.defaultBinding = key('H');
    keystroke(d, makeCtx({ ...ctx, actions: makeRegistry([insideHeld, outside]) }), 'H');
    expect(insideHeld.run).toHaveBeenCalledOnce();
    expect(outside.run).not.toHaveBeenCalled();
  });

  it('closes on Escape without reaching an Escape binding outside', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    keystroke(d, ctxFor(), 'Escape');
    expect(outsideEscape.run).not.toHaveBeenCalled();
    expect(stack.open()).toEqual([]);
  });

  it('lets a bare modifier through without closing', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    keystroke(d, ctxFor(), 'Shift');
    expect(stack.open().map((k) => k.id)).toEqual(['loupe']);
  });

  it('routes a click it does not bind as usual, and closes', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    stack.batch(() => d.handleInput(click, ctxFor()));
    expect(outsideClick.run).toHaveBeenCalledOnce();
    expect(stack.open()).toEqual([]);
  });

  it('stays open through a click while its leader is held', () => {
    stack.push('loupe', 'Loupe', { heldBy: 'leader' });
    const d = createDispatcher();
    stack.batch(() => d.handleInput(click, ctxFor()));
    expect(outsideClick.run).toHaveBeenCalledOnce();
    expect(stack.open().map((k) => k.id)).toEqual(['loupe']);
  });

  it('keeps a press from the drag outside it when it binds a click, and takes the click', () => {
    stack.push('loupe', 'Loupe');
    const dragStart = vi.fn().mockReturnValue({ onEnd: vi.fn() });
    const drag: Action = { id: 'drag', label: 'drag', defaultBinding: { kind: 'drag' }, invoker: { timing: 'ongoing', start: dragStart } };
    const pin = act('pin');
    const entry: Contribution<never> = { id: 'loupe', eligibility: { keymap: true }, bindings: [{ spec: { kind: 'click' }, actionId: 'pin' }] };
    const ctx = makeCtx({ actions: makeRegistry([drag, pin]), entriesById: new Map([['loupe', entry]]), keymaps: stack });
    const d = createDispatcher();
    const p = { pointerId: 1, pointerType: 'mouse' as const, button: 0, buttons: 1, x: 0, y: 0, clientX: 0, clientY: 0, ...mods };
    stack.batch(() => d.handleInput({ kind: 'pointerdown', ...p } as InputEvent, ctx));
    expect(dragStart).not.toHaveBeenCalled();
    stack.batch(() => d.handleInput(click, ctx));
    expect(pin.run).toHaveBeenCalledOnce();
  });

  it('closes, and swallows nothing, once its entry is gone', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    keystroke(d, { ...ctxFor(), entriesById: new Map() }, '3');
    expect(outside.run).toHaveBeenCalledOnce();
    expect(stack.open()).toEqual([]);
  });

  it('leaves a key alone on a surface that hears it only because the pointer is over it', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    expect(keystroke(d, ctxFor({ keyReach: { held: false, over: true } }), '2')).toEqual(['unhandled', 'unhandled']);
    expect(stack.open().map((k) => k.id)).toEqual(['loupe']);
  });

  it('lets a Ctrl or Cmd chord through under modal, and stays open', () => {
    stack.push('loupe', 'Loupe');
    const d = createDispatcher();
    const copy = act('copy');
    copy.defaultBinding = { kind: 'key', key: 'c', mods: { ctrl: true } };
    const ctx = makeCtx({ ...ctxFor(), actions: makeRegistry([inside, copy]) });
    stack.batch(() => d.handleInput({ kind: 'key', key: 'c', ...mods, ctrlKey: true }, ctx));
    expect(copy.run).toHaveBeenCalledOnce();
    expect(stack.open().map((k) => k.id)).toEqual(['loupe']);
  });
});
