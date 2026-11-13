/**
 * The loupe's bindable interactions, as `Action` descriptors the gesture
 * dispatcher routes: aim at the pointer, pressed or not, and learn when it
 * leaves; hold a key to peek; walk the magnification with the wheel; and,
 * while the eyedropper is on, pick the color under a click. Every painter's
 * lens aims through these, so they agree on when it follows.
 */
import { type Action, heldKeySpec } from '@weasel-js/routing';

/** Canonical id of the hold-to-peek action. */
export const LOUPE_PEEK_ID = 'loupe.peek';
/** Canonical id of the wheel-magnify action. */
export const LOUPE_MAGNIFY_ID = 'loupe.magnify';
/** Canonical id of the action that aims the lens at the pointer. */
export const LOUPE_AIM_ID = 'loupe.aim';
/** Canonical id of the action that learns the pointer has left the host. */
export const LOUPE_LEAVE_ID = 'loupe.leave';
/** Canonical id of the eyedropper's click. */
export const LOUPE_PICK_ID = 'loupe.pick';

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

/** What the aim actions do to a live loupe. Every member is read through the
 *  object on each invocation, so one stable instance serves the life of the
 *  registration. */
export interface LoupeAimInput {
  /** The pointer is over the host at this client point; `held` while a button
   *  is down on it. */
  aimAt: (clientX: number, clientY: number, held: boolean) => void;
  /** The pointer has left the host. */
  leave: () => void;
}

/** What every loupe action does to a live loupe, read as {@link LoupeAimInput} is. */
export interface LoupeInputApi extends LoupeAimInput {
  /** Whether the lens is up. The wheel belongs to the loupe only while it is;
   *  otherwise `loupe.magnify` declines and the dispatcher falls through to
   *  the trial camera's zoom. */
  shown: () => boolean;
  /** Raise or drop the hold-to-peek flag. */
  setPeeking: (on: boolean) => void;
  /** Multiply the magnification by one wheel notch of `deltaY`. */
  magnifyBy: (deltaY: number) => void;
  /** Whether the eyedropper is on. `loupe.pick` declines while it is not, and
   *  the click goes to whatever else binds it. */
  dropping: () => boolean;
  /** Pick the color at the pointer: what a lens shows there, when it is over
   *  one, and the host's own pixels otherwise. */
  pickAtPointer: () => void;
}

/**
 * The loupe's aim: `loupe.aim` follows the pointer over the host, pressed or
 * not, and `loupe.leave` learns when it goes. Whether a press freezes the aim
 * is the lens's to decide from `held`.
 */
export function createLoupeAimActions(input: LoupeAimInput): readonly [Action, Action] {
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
        input.aimAt(params?.clientX as number, params?.clientY as number, params?.held === true);
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

  return [aim, leave];
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

  const [aim, leave] = createLoupeAimActions(input);

  // Hotkey scope, so while the eyedropper is on a click picks rather than
  // reaching the trial's active tool. It reads the pointer the hover last
  // reported, which is the host's own px; a click carries only world points.
  const pick: Action = {
    id: LOUPE_PICK_ID,
    label: 'Pick color (eyedropper)',
    group: 'loupe',
    scope: 'hotkey',
    defaultBinding: [
      { spec: { kind: 'click', mods: ANY_MODS }, opts: { id: `${LOUPE_PICK_ID}.click` } },
    ],
    enabled: () => (input.dropping() ? true : 'not-applicable'),
    invoker: {
      timing: 'immediate',
      run() {
        input.pickAtPointer();
      },
    },
  };

  if (peekKey === null) return [aim, leave, magnify, pick];

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
  return [aim, leave, peek, magnify, pick];
}
