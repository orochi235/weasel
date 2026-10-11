/** The keyboard channel: window keydown and keyup as `key` and `key-held` input. */
import { activatesFocusedControl, isEditableTarget } from '../../keyHelpers';
import type { DispatchCore } from '../dispatchCore';
import type { Dispatcher } from '../dispatcherApi';
import type { InputEvent } from '../matcher';

export function keyboardInput(core: DispatchCore): {
  onKeyDown: (e: KeyboardEvent) => void;
  onKeyUp: (e: KeyboardEvent) => void;
  /** End every held key, as a window that lost focus must: it never delivers the keyup. */
  releaseAll: () => void;
} {
  const { dispatch, dispatcherNow } = core;

  // Held keys by physical key, mapped to the `key` they went down as (Shift
  // pressed mid-hold makes the keyup of an 'o' press report 'O') and the
  // dispatcher that took the down, which hover may have routed away from.
  const heldKeys = new Map<string, { key: string; code?: string; on: Dispatcher }>();
  const codeOf = (e: KeyboardEvent): { code?: string } => (e.code ? { code: e.code } : {});
  const physicalKey = (e: KeyboardEvent): string => e.code || e.key.toLowerCase();

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || isEditableTarget(e.target) || activatesFocusedControl(e)) return;
    // Every dispatcher hears keys on window; only the active scope's act.
    if (!core.isActive()) return;

    // Autorepeat for a key that's already engaged a key-held binding is
    // suppressed entirely — no dispatch (no trace flood) and the
    // browser default is blocked. Holding Space-for-hand otherwise
    // streamed an 'unhandled' immediate-`key` trace entry per repeat.
    // Autorepeat for a key that ISN'T held still dispatches normally,
    // so things like Cmd+= step-zoom keep auto-repeating.
    if (e.repeat && heldKeys.has(physicalKey(e))) {
      e.preventDefault();
      return;
    }

    // Dispatch both key and key-held forms unconditionally. The dispatcher
    // de-dupes naturally because each form uses a different gestureId and
    // different GestureSpec kind. The dispatcher returns 'unhandled' when no
    // binding matches the alternate form, so there's no double-fire risk.

    const keyEv: InputEvent = {
      kind: 'key',
      key: e.key,
      ...codeOf(e),
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      repeat: e.repeat,
    };
    const keyResult = dispatch(keyEv);

    // Always dispatch key-held DOWN, even on autorepeat. The dispatcher's
    // own defense returns 'handled' (no-op) when a handle is already in
    // flight for this gestureId, which both prevents start() re-invocation
    // and lets us preventDefault the repeat so the page doesn't react.
    const heldEv: InputEvent = {
      kind: 'key-held',
      key: e.key,
      ...codeOf(e),
      phase: 'down',
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
    };
    const heldOn = dispatcherNow();
    const heldResult = dispatch(heldEv, heldOn);

    if (heldResult === 'handled') {
      heldKeys.set(physicalKey(e), { key: e.key, ...codeOf(e), on: heldOn });
    }

    if (keyResult === 'handled' || heldResult === 'handled') {
      e.preventDefault();
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const physical = physicalKey(e);
    const down = heldKeys.get(physical);
    if (down === undefined) return;
    const ev: InputEvent = {
      kind: 'key-held',
      key: down.key,
      ...(down.code !== undefined ? { code: down.code } : {}),
      phase: 'up',
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
    };
    heldKeys.delete(physical);
    dispatch(ev, down.on);
  };

  const releaseAll = (): void => {
    const releasing = [...heldKeys.values()];
    heldKeys.clear();
    for (const { key, code, on } of releasing) {
      const ev: InputEvent = {
        kind: 'key-held',
        key,
        ...(code !== undefined ? { code } : {}),
        phase: 'up',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };
      dispatch(ev, on);
    }
  };

  return { onKeyDown, onKeyUp, releaseAll };
}
