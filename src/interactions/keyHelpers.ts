/**
 * Pure keyboard-binding helpers shared between the tool dispatcher
 * (`useKeybindings`), the gesture dispatcher (`useGestureDispatcher`), and
 * individual Tool declarations.
 *
 * Extracted from the deleted singular `useKeybinding` hook so the remaining
 * consumers don't depend on its disappearance.
 */

/** Declarative keybinding description used by the tool dispatcher. */
export interface KeyBinding {
  /**
   * Key or list of keys to match. Compared case-insensitively against
   * `event.key`, so `'a'` matches both `'a'` and `'A'`.
   */
  key: string | readonly string[];
  /**
   * Require Cmd (mac) or Ctrl (others). When `true`, exactly one of
   * `metaKey`/`ctrlKey` must be held. Default `false` (both forbidden).
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

/** Returns true when the target is an input, textarea, or contenteditable element. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((target as HTMLElement).isContentEditable) return true;
  const ce = target.getAttribute('contenteditable');
  return ce === 'true' || ce === '';
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
export function matchesKeyBinding(e: KeyboardEvent, b: KeyBinding): boolean {
  if (!keyMatches(e.key, b.key)) return false;

  const wantsMod = b.mod === true;
  const hasMod = e.metaKey || e.ctrlKey;
  if (wantsMod !== hasMod) return false;

  const wantsAlt = b.alt === true;
  if (wantsAlt !== e.altKey) return false;

  const shift = b.shift;
  if (shift === undefined || shift === false) {
    if (e.shiftKey) return false;
  } else if (shift === true) {
    if (!e.shiftKey) return false;
  }
  return true;
}
