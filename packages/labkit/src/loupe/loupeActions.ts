/**
 * The loupe's bindable interactions, as `Action` descriptors the gesture
 * dispatcher routes: aim at the pointer, pressed or not, and put the lens away
 * when it leaves; hold a key to peek; walk the magnification with the wheel.
 *
 * Free of React so the routing can be tested without a DOM.
 */
import { type Action, heldKeySpec } from '@weasel-js/core';

/** Canonical id of the hold-to-peek action. */
export const LOUPE_PEEK_ID = 'loupe.peek';
/** Canonical id of the wheel-magnify action. */
export const LOUPE_MAGNIFY_ID = 'loupe.magnify';
/** Canonical id of the action that aims the lens at the pointer. */
export const LOUPE_AIM_ID = 'loupe.aim';
/** Canonical id of the action that learns the pointer has left the host. */
export const LOUPE_LEAVE_ID = 'loupe.leave';

/** Every modifier optional: the lens follows the pointer with any held, the
 *  peek key among them. */
const ANY_MODS = {
  alt: 'optional',
  ctrl: 'optional',
  meta: 'optional',
  shift: 'optional',
} as const;

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
  /** The pointer is over the host at this client point. */
  aimAt: (clientX: number, clientY: number) => void;
  /** The pointer has left the host. */
  leave: () => void;
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
      { spec: { kind: 'wheel', mods: ANY_MODS }, opts: { id: `${LOUPE_MAGNIFY_ID}.wheel` } },
    ],
    enabled: () => (input.shown() ? true : 'not-applicable'),
    invoker: {
      timing: 'immediate',
      run(_deps, params) {
        input.magnifyBy((params?.deltaY as number | undefined) ?? 0);
      },
    },
  };

  // `held`: the lens keeps following through a drag, which a plain hover
  // stands down for.
  const aim: Action = {
    id: LOUPE_AIM_ID,
    label: 'Aim (loupe)',
    group: 'loupe',
    defaultBinding: [
      {
        spec: { kind: 'hover', held: 'optional', mods: ANY_MODS },
        opts: { id: `${LOUPE_AIM_ID}.hover` },
      },
    ],
    invoker: {
      timing: 'immediate',
      run(_deps, params) {
        input.aimAt(params?.clientX as number, params?.clientY as number);
      },
    },
  };

  const leave: Action = {
    id: LOUPE_LEAVE_ID,
    label: 'Put away (loupe)',
    group: 'loupe',
    defaultBinding: [
      {
        spec: { kind: 'hover', motion: 'leave', mods: ANY_MODS },
        opts: { id: `${LOUPE_LEAVE_ID}.hover` },
      },
    ],
    invoker: {
      timing: 'immediate',
      run() {
        input.leave();
      },
    },
  };

  if (peekKey === null) return [aim, leave, magnify];

  const peek: Action = {
    id: LOUPE_PEEK_ID,
    label: 'Peek (loupe)',
    group: 'loupe',
    // Hotkey scope: peeking must beat whatever the lab's active tool binds to
    // the same key, the way every other held-key trigger does. `over`: the
    // key peeks the loupe under the pointer, not the one last pressed in.
    scope: 'hotkey',
    defaultBinding: [
      { spec: heldKeySpec(peekKey), opts: { id: `${LOUPE_PEEK_ID}.held`, over: true } },
    ],
    invoker: {
      timing: 'ongoing',
      start() {
        input.setPeeking(true);
        return { onEnd: () => input.setPeeking(false) };
      },
    },
  };
  return [aim, leave, peek, magnify];
}
