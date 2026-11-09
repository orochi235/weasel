/** The keyboard channel: window keydown and keyup as `key` and `key-held` input. */
import { focusedControlOwnsKey, isEditableTarget } from '../../keyHelpers';
import type { DispatchCore } from '../dispatchCore';
import type { KeyReach } from '../dispatcherApi';
import type { InputEvent } from '../matcher';
import { keymapKeys } from './keymapKeys';
import { passOn, type TakeKey } from './keyPeers';
import { inModalOver } from './modal';
import { followPointer, releaseIn, type HeldKey } from './overKeys';

/** Whether `key` is one code point: a typed character, astral ones included. */
const oneCodePoint = (key: string): boolean => key.length === 1 || (key.length === 2 && key.codePointAt(0)! > 0xffff);

/**
 * True when AltGr typed the character `e` reports. A layout that types `[` with
 * AltGr reports Ctrl and Alt held with it, which are part of the keystroke
 * rather than a chord. A key that reports its own unshifted letter or digit
 * typed nothing through AltGr: Firefox on Windows reports AltGraph for a plain
 * Ctrl+Alt too, and that one is a chord.
 */
function typedWithAltGraph(e: KeyboardEvent): boolean {
  if (!e.ctrlKey || !e.altKey || !oneCodePoint(e.key) || !e.getModifierState?.('AltGraph')) return false;
  const base = /^(?:Key|Digit)(.)$/.exec(e.code)?.[1];
  return base === undefined || base.toLowerCase() !== e.key.toLowerCase();
}

/** The `key` and `key-held` down events one keydown dispatches as, with `mods` for its Alt and Ctrl. */
function keystrokeEvents(e: KeyboardEvent, mods: { altKey: boolean; ctrlKey: boolean }): { keyEv: InputEvent; heldEv: InputEvent } {
  const common = { key: e.key, ...(e.code ? { code: e.code } : {}), ...mods, metaKey: e.metaKey, shiftKey: e.shiftKey };
  return {
    keyEv: { kind: 'key', ...common, repeat: e.repeat },
    heldEv: { kind: 'key-held', ...common, phase: 'down' },
  };
}

type Mods = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;
const NO_MODS: Mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

/** The `key-held` up event releasing `down`, with the modifiers of `mods`. */
function releaseOf(down: HeldKey, mods: Mods): InputEvent {
  return {
    kind: 'key-held', key: down.key, ...(down.code !== undefined ? { code: down.code } : {}), phase: 'up',
    altKey: mods.altKey, ctrlKey: mods.ctrlKey, metaKey: mods.metaKey, shiftKey: mods.shiftKey,
  };
}

/** True inside an open ARIA menu, which owns every key typed in it. */
const inMenu = (t: EventTarget | null): boolean => t instanceof Element && t.closest('[role="menu"]') !== null;

export function keyboardInput(core: DispatchCore): {
  onKeyDown: (e: KeyboardEvent) => void;
  onKeyUp: (e: KeyboardEvent) => void;
  /** A keystroke the dispatcher holding the keys on this surface declined: handle it as though this one held them. */
  take: TakeKey;
  /** End every held key, as a window that lost focus must: it never delivers the keyup. */
  releaseAll: () => void;
  /** The pointer came over the canvas: press the keys already held for its `over` bindings. */
  arrive: (e: PointerEvent) => void;
  /** The pointer left the canvas: release what its `over` bindings hold. */
  leave: () => void;
} {
  const { dispatch, dispatcherNow } = core;

  // Held keys by physical key, mapped to the `key` they went down as (Shift
  // pressed mid-hold makes the keyup of an 'o' press report 'O') and the
  // dispatcher that took the down, which hover may have routed away from.
  const heldKeys = new Map<string, HeldKey>();
  // Every key down on the page, taken or not, for `arrive` to press again.
  const downKeys = new Map<string, Omit<HeldKey, 'on' | 'view'>>();
  const keymaps = keymapKeys(core.keymaps);
  const codeOf = (e: KeyboardEvent): { code?: string } => (e.code ? { code: e.code } : {});
  const physicalKey = (e: KeyboardEvent): string => e.code || e.key.toLowerCase();
  // Keystrokes already offered here by a peer on the surface, which this channel's own listener leaves.
  const taken = new WeakSet<Event>();

  const onKeyDown = (e: KeyboardEvent) => {
    // Before the filters: a key another surface took is still down.
    downKeys.set(physicalKey(e), { key: e.key, ...codeOf(e), withCmd: e.metaKey });
    if (e.defaultPrevented || isEditableTarget(e.target) || inMenu(e.target) || focusedControlOwnsKey(e)) return;
    if (inModalOver(e.target, core.canvas) || taken.has(e)) return;
    // Every dispatcher hears keys on window. The one holding them acts, and so
    // does the one under the pointer, for its `over` bindings alone.
    const reach: KeyReach = { held: core.holdsKeys(), over: core.pointerOver() };
    if (!reach.held && !reach.over) return;
    consider(e, reach);
    if (reach.held && core.canvas) passOn(core.canvas, take, e);
  };

  const take: TakeKey = (e) => {
    taken.add(e);
    consider(e, { held: true, over: core.pointerOver() });
  };

  const consider = (e: KeyboardEvent, reach: KeyReach): void => {
    // Autorepeat for a key that's already engaged a key-held binding is
    // suppressed entirely — no dispatch (no trace flood) and the
    // browser default is blocked. Holding Space-for-hand otherwise
    // streamed an 'unhandled' immediate-`key` trace entry per repeat.
    // Autorepeat for a key that ISN'T held still dispatches normally,
    // so things like Cmd+= step-zoom keep auto-repeating.
    if (e.repeat && (heldKeys.has(physicalKey(e)) || keymaps.quiet(physicalKey(e)))) {
      e.preventDefault();
      return;
    }

    // The chord as reported comes first, so a binding that names Ctrl+Alt keeps it —
    // except in an open keymap, which would swallow it before the character typed could try.
    const altGr = typedWithAltGraph(e);
    const typed = { altKey: false, ctrlKey: false };
    keymaps.press(e, physicalKey(e), () => core.batch(() => (altGr && core.keymaps()?.innermost()
      ? press(e, typed, reach)
      : press(e, { altKey: e.altKey, ctrlKey: e.ctrlKey }, reach) || (altGr && press(e, typed, reach)))));
  };

  /** Dispatch `e` as both `key` and `key-held` with `mods` for its Alt and Ctrl. True when either was handled. */
  const press = (e: KeyboardEvent, mods: { altKey: boolean; ctrlKey: boolean }, reach: KeyReach): boolean => {
    // Both forms dispatch unconditionally. The dispatcher
    // de-dupes naturally because each form uses a different gestureId and
    // different GestureSpec kind. The dispatcher returns 'unhandled' when no
    // binding matches the alternate form, so there's no double-fire risk.

    const { keyEv, heldEv } = keystrokeEvents(e, mods);
    const keyResult = dispatch(keyEv, undefined, reach);

    // Always dispatch key-held DOWN, even on autorepeat. The dispatcher's
    // own defense returns 'handled' (no-op) when a handle is already in
    // flight for this gestureId, which both prevents start() re-invocation
    // and lets us preventDefault the repeat so the page doesn't react.
    const heldOn = dispatcherNow();
    const heldResult = dispatch(heldEv, heldOn, reach);

    if (heldResult === 'handled') {
      heldKeys.set(physicalKey(e), { key: e.key, ...codeOf(e), withCmd: e.metaKey, on: heldOn, view: core.routedView() });
    }

    const handled = keyResult === 'handled' || heldResult === 'handled';
    if (handled) e.preventDefault();
    return handled;
  };

  const keyUp = (physical: string, e: KeyboardEvent): void => {
    downKeys.delete(physical);
    const down = heldKeys.get(physical);
    if (down === undefined) return;
    heldKeys.delete(physical);
    releaseIn(core, down, releaseOf(down, e));
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const physical = physicalKey(e);
    keymaps.up(e, physical);
    keyUp(physical, e);
    // macOS sends no keyup for a key released while Cmd is down, so Cmd's own keyup releases it.
    if (e.key !== 'Meta') return;
    for (const [k, down] of [...downKeys, ...heldKeys]) if (down.withCmd) keyUp(k, e);
  };

  const releaseAll = (): void => {
    downKeys.clear();
    keymaps.clear();
    const releasing = [...heldKeys.values()];
    heldKeys.clear();
    for (const down of releasing) releaseIn(core, down, releaseOf(down, NO_MODS));
  };

  return { onKeyDown, onKeyUp, take, releaseAll, ...followPointer(core, downKeys, heldKeys) };
}
