/**
 * The loupe's two bindable interactions, as `Action` descriptors the gesture
 * dispatcher routes: hold a key to peek, and walk the magnification with the
 * wheel.
 *
 * Free of React so the routing can be tested without a DOM.
 */
import type { Action } from '@weasel-js/core';

/** Canonical id of the hold-to-peek action. */
export const LOUPE_PEEK_ID = 'loupe.peek';
/** Canonical id of the wheel-magnify action. */
export const LOUPE_MAGNIFY_ID = 'loupe.magnify';

/** How fast the wheel walks the magnification. Gentler than the pan-zoom
 *  wheel: the lens' whole range is one order of magnitude. */
export const WHEEL_RATE = 0.002;

/** What the actions do to a live loupe. Every member is read through the
 *  object on each invocation, so one stable instance serves the life of the
 *  registration. */
export interface LoupeInputApi {
  /** Whether the lens is up. The wheel belongs to the loupe only while it is;
   *  otherwise `loupe.magnify` declines and the dispatcher falls through to
   *  the trial camera's zoom. */
  shown: () => boolean;
  /** Raise or drop the hold-to-peek flag. */
  setPeeking: (on: boolean) => void;
  /** Multiply the magnification by one wheel notch of `deltaY`. */
  magnifyBy: (deltaY: number) => void;
}

/**
 * Build the loupe's actions. `peekKey` is a `KeyboardEvent.key`; passing
 * `null` omits `loupe.peek` entirely rather than registering a binding no key
 * can match.
 */
export function createLoupeActions(
  input: LoupeInputApi,
  peekKey: string | null,
): readonly Action[] {
  const magnify: Action = {
    id: LOUPE_MAGNIFY_ID,
    label: 'Magnify (loupe)',
    group: 'loupe',
    // Hotkey scope, so while the lens is up it outranks the trial camera's
    // wheel zoom on the same dispatcher; while it is down `enabled` declines
    // and the zoom runs.
    scope: 'hotkey',
    // Every modifier optional: the lens claims the wheel whenever it is up,
    // which is what the hand-rolled capture-phase listener did. A bare spec
    // would forbid modifiers and hand Cmd+wheel back to the lab mid-peek.
    defaultBinding: [
      {
        spec: {
          kind: 'wheel',
          mods: { alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' },
        },
        opts: {},
      },
    ],
    enabled: () => (input.shown() ? true : 'not-applicable'),
    invoker: {
      timing: 'immediate',
      run(_deps, params) {
        input.magnifyBy((params?.deltaY as number | undefined) ?? 0);
      },
    },
  };

  if (peekKey === null) return [magnify];

  const peek: Action = {
    id: LOUPE_PEEK_ID,
    label: 'Peek (loupe)',
    group: 'loupe',
    // Hotkey scope: peeking must beat whatever the lab's active tool binds to
    // the same key, the way every other held-key trigger does.
    scope: 'hotkey',
    // Every modifier optional because the peek key may BE one: the keydown
    // that carries `Alt` — the default — also reports `altKey: true`, and the
    // matcher forbids any modifier a spec does not name.
    defaultBinding: [
      {
        spec: {
          kind: 'key-held',
          key: peekKey,
          mods: { alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' },
        },
        opts: {},
      },
    ],
    invoker: {
      timing: 'ongoing',
      start() {
        input.setPeeking(true);
        return { onEnd: () => input.setPeeking(false) };
      },
    },
  };
  return [peek, magnify];
}
