/**
 * Tiny keyboard-binding hook. Centralizes the boilerplate that every
 * action-level hook (`useDelete`, `useEscape`, etc.) repeated:
 *   - skip when focus is in an editable element
 *   - match a key (or set of keys) against optional modifiers
 *   - preventDefault before invoking the handler
 *
 * The handler receives the raw `KeyboardEvent` so callers that need a
 * modifier value at dispatch time (e.g. nudge reading `shiftKey`) can
 * inspect it directly.
 */

import { useEffect, useRef } from 'react';
import { useIsDispatcherMounted } from '../dispatcher/dispatcherPresence';

/** Declarative keybinding description used by `useKeybinding`. */
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
  /**
   * Phase 3+: when `true` AND the gesture dispatcher is mounted in scope,
   * this binding does NOT attach its keydown listener — the dispatcher
   * handles it instead. Default `false` (legacy behavior unchanged).
   */
  disabledIfDispatcherActive?: boolean;
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
 * Pure matcher for `KeyBinding` against a `KeyboardEvent`. Only checks
 * key + modifier policy — does NOT apply the editable-target skip or
 * `preventDefault`. Shared by `useKeybinding` (action layer) and
 * `useKeybindings` (tool dispatcher) so the rules can't drift.
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

/**
 * Bind a keyboard handler on `document`, with the conventional skip-rules
 * applied. Re-attaches when `binding.enabled` flips; the handler ref is
 * always read fresh so callers can use closures without re-binding.
 */
export function useKeybinding(
  binding: KeyBinding,
  handler: (event: KeyboardEvent) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const bindingRef = useRef(binding);
  bindingRef.current = binding;

  const dispatcherActive = useIsDispatcherMounted();
  const effectivelyEnabled =
    (binding.enabled ?? true) &&
    !(binding.disabledIfDispatcherActive && dispatcherActive);

  useEffect(() => {
    if (!effectivelyEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      const b = bindingRef.current;
      if (!matchesKeyBinding(e, b)) return;

      const skipEditable = b.skipInEditable ?? true;
      if (skipEditable && isEditableTarget(e.target)) return;

      if ((b.preventDefault ?? true)) e.preventDefault();
      handlerRef.current(e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [effectivelyEnabled]);
}
