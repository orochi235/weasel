/**
 * GestureSpec — describes the form of a user input event that can fire an action.
 *
 * Used by `Action.defaultBinding` (the action's preferred gesture) and by
 * `GestureBinding.spec` (a tool's binding table entry). The dispatcher matches
 * incoming input events against registered specs to determine which action to
 * invoke.
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md` § "Types".
 */

/** Optional modifier-key requirement for a gesture spec. All fields are
 *  optional; an omitted field means "either is acceptable." A `true` means
 *  the modifier MUST be held; `false` means it MUST NOT be held. */
export type ModSpec = Partial<{
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}>;

/** Target selector for click and drag gesture specs. String forms are sugar
 *  for the kit-owned object-kind registry (TODO.md Tier 1 follow-up); until
 *  that ships, consumers can pass `{ kindOf: predicate }` to classify hits
 *  themselves. */
export type TargetSpec =
  | 'empty'
  | 'selected-body'
  | 'unselected-body'
  | `kind:${string}`
  | `kind:${string}:selected`
  | `affordance:${string}`
  | { kindOf: (hit: unknown) => boolean };

/** Single-keystroke gesture (keydown). */
export interface KeySpec {
  kind: 'key';
  key: string;
  mods?: ModSpec;
}

/** Key-held gesture (keydown opens, keyup closes). Drives "hold space for
 *  hand tool"-style interactions. */
export interface KeyHeldSpec {
  kind: 'key-held';
  key: string;
  mods?: ModSpec;
}

/** Wheel-event gesture. */
export interface WheelSpec {
  kind: 'wheel';
  mods?: ModSpec;
}

/** Click gesture (pointerdown + pointerup without movement past the
 *  threshold). */
export interface ClickSpec {
  kind: 'click';
  target?: TargetSpec;
  mods?: ModSpec;
}

/** Drag gesture (pointerdown + pointermove past the threshold). */
export interface DragSpec {
  kind: 'drag';
  target?: TargetSpec;
  mods?: ModSpec;
}

/** Multi-touch gesture. `fingers` is the required touch count. */
export interface MultiTouchSpec {
  kind: 'multiTouch';
  fingers: number;
  mods?: ModSpec;
}

/** The full union of supported gesture spec kinds. New invocation forms
 *  (long-press, two-stage, modal-dialog) extend this union without touching
 *  the `Action` type. */
export type GestureSpec =
  | KeySpec
  | KeyHeldSpec
  | WheelSpec
  | ClickSpec
  | DragSpec
  | MultiTouchSpec;
