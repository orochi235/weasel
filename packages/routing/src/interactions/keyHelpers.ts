/**
 * Pure keyboard-binding helpers shared between the tool dispatcher
 * (`useKeybindings`), the gesture dispatcher (`useGestureDispatcher`), and
 * individual Tool declarations.
 *
 * Extracted from the deleted singular `useKeybinding` hook so the remaining
 * consumers don't depend on its disappearance.
 *
 * @packageDocumentation
 */

import { isApplePlatform, matchModifiers } from '@weasel-js/gestures';

export { activatesFocusedControl, focusedControlOwnsKey, isEditableTarget } from '@weasel-js/gestures';

/**
 * A key plus a modifier policy, as {@link matchesKeyBinding} tests it against a
 * `KeyboardEvent`. Every modifier left unset is forbidden, so `{ key: 'a' }`
 * does not fire on Cmd+A. The matcher ignores `skipInEditable`, `enabled` and
 * `preventDefault`; those are for whatever attaches the listener. Tools
 * declaring an activation key use `ToolKeybinding` instead.
 */
export interface KeyBinding {
  /**
   * Key or list of keys to match. Compared case-insensitively against
   * `event.key`, so `'a'` matches both `'a'` and `'A'`.
   */
  key: string | readonly string[];
  /**
   * Require `mod`: Cmd on an Apple platform, Ctrl elsewhere, with the other
   * key forbidden — `mod` as `@weasel-js/gestures` defines it. Default `false`
   * (both forbidden).
   */
  mod?: boolean;
  /** Require Alt. Default `false` (forbidden). */
  alt?: boolean;
  /**
   * Shift policy. `undefined`/`false` forbids shift, `true` requires
   * shift, `'optional'` allows either. Default `undefined`.
   */
  shift?: boolean | 'optional';
  /** Skip when focus is in an editable element. Default `true`. */
  skipInEditable?: boolean;
  /** When `false`, the listener is not attached. Default `true`. */
  enabled?: boolean;
  /** Call `preventDefault` before the handler. Default `true`. */
  preventDefault?: boolean;
}

function keyMatches(eventKey: string, spec: string | readonly string[]): boolean {
  const want = typeof spec === 'string' ? [spec] : spec;
  const ek = eventKey.toLowerCase();
  return want.some((k) => k.toLowerCase() === ek);
}

/**
 * Pure matcher for `KeyBinding` against a `KeyboardEvent`. Only checks key +
 * modifier policy — does NOT apply the editable-target skip or
 * `preventDefault`. Shared by the tool dispatcher (`useKeybindings`) and the
 * gesture dispatcher so the rules can't drift.
 */
export function matchesKeyBinding(e: KeyBindingEvent, b: KeyBinding, isMac = isApplePlatform()): boolean {
  if (!keyMatches(e.key, b.key)) return false;
  return matchModifiers(e, { mod: b.mod === true, alt: b.alt === true, shift: b.shift ?? false }, isMac);
}

/** The fields of a keyboard event {@link matchesKeyBinding} reads, so a React event passes as readily as a DOM one. */
export type KeyBindingEvent = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

/** Which history step `e` asks for: Mod+Z undoes, Shift+Mod+Z and Mod+Y redo. `null` for anything else. Takes a
 *  React keyboard event as readily as a DOM one. */
export function historyKey(e: KeyBindingEvent, isMac = isApplePlatform()): 'undo' | 'redo' | null {
  if (matchesKeyBinding(e, { key: 'z', mod: true }, isMac)) return 'undo';
  if (matchesKeyBinding(e, { key: 'z', mod: true, shift: true }, isMac) || matchesKeyBinding(e, { key: 'y', mod: true }, isMac))
    return 'redo';
  return null;
}
