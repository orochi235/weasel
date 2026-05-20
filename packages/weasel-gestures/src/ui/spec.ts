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

/** Optional modifier-key requirement for a gesture spec.
 *
 *  Matching semantics (strict): an omitted modifier field means the
 *  modifier MUST NOT be held — i.e., a bare `{ kind: 'key', key: 'Escape' }`
 *  matches only unmodified Escape, NOT Cmd+Escape. A `true` means the
 *  modifier MUST be held; `false` is the same as omitted (must be absent).
 *  This mirrors today's `KeyBinding` matcher and keeps conflict detection
 *  coherent.
 *
 *  `mod` is a platform-aware shorthand: matches `metaKey` on mac, `ctrlKey`
 *  elsewhere (mirrors `KeyBinding.mod`).
 *
 *  `shift` additionally accepts `'optional'` meaning "shifted or unshifted
 *  both acceptable" — the explicit opt-in for loose matching, used by
 *  actions like nudge whose step size depends on shift but whose firing
 *  does not. To widen other modifiers similarly, extend their type when
 *  a real consumer needs it.
 */
export type ModSpec = Partial<{
  alt: boolean | 'optional';
  ctrl: boolean | 'optional';
  meta: boolean | 'optional';
  mod: boolean | 'optional';
  shift: boolean | 'optional';
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

/** Phase qualifier on a gesture spec. Restricts when the spec matches based
 *  on per-tool gesture-lifecycle state.
 *
 *  Shorthand forms (most common case — gate on the binding's own tool):
 *    `'engaged'` → `[{ channel: '&', phase: 'engaged' }]`  // self mid-gesture
 *    `'initial'` → `[{ channel: '&', phase: 'initial' }]`  // self idle
 *    `'*'`       → `[{ channel: '&', phase: '*' }]`        // either self phase
 *
 *  Array form for explicit channel:phase atoms — e.g. `[{ channel: 'rect',
 *  phase: 'engaged' }]` for "when the rect tool is mid-gesture, regardless of
 *  which scope I'm in." See the v3 route grammar in
 *  `@orochi235/weasel-gestures/grammar` for the full lattice.
 *
 *  When omitted, matches in any phase (preserves pre-phase behavior). */
export type PhaseSpec = 'initial' | 'engaged' | '*' | readonly import('../grammar/routeGrammar').PhaseAtom[];

/** Single-keystroke gesture (keydown). */
export interface KeySpec {
  kind: 'key';
  /** A single key, or an array of acceptable keys (case-insensitive match). */
  key: string | string[];
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** Key-held gesture (keydown opens, keyup closes). Drives "hold space for
 *  hand tool"-style interactions. */
export interface KeyHeldSpec {
  kind: 'key-held';
  /** A single key, or an array of acceptable keys (case-insensitive match). */
  key: string | string[];
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** Wheel-event gesture. `direction` filters by deltaY sign; default `'*'`.
 *  - `'up'`   → matches only deltaY < 0
 *  - `'down'` → matches only deltaY > 0
 *  - `'*'`    → matches either sign (default; universal-wildcard convention) */
export interface WheelSpec {
  kind: 'wheel';
  direction?: 'up' | 'down' | '*';
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** Click gesture (pointerdown + pointerup without movement past the
 *  threshold). */
export interface ClickSpec {
  kind: 'click';
  target?: TargetSpec;
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** Right-click (contextmenu) gesture. The dispatcher calls
 *  `preventDefault()` on the underlying DOM event so the native menu
 *  doesn't appear — tools/actions fully own the right-click UX. */
export interface ContextMenuSpec {
  kind: 'contextMenu';
  target?: TargetSpec;
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** Drag gesture (pointerdown + pointermove past the threshold). */
export interface DragSpec {
  kind: 'drag';
  target?: TargetSpec;
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** Multi-touch gesture. `fingers` is the required touch count. */
export interface MultiTouchSpec {
  kind: 'multiTouch';
  fingers: number;
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** Multi-touch tap gesture — fires when N fingers touch down then release
 *  together without movement past the tap threshold. Synthesized by the
 *  dispatcher from the underlying multitouch tracking. */
export interface MultiTouchTapSpec {
  kind: 'multiTouchTap';
  fingers: number;
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** The full union of supported gesture spec kinds. New invocation forms
 *  (long-press, two-stage, modal-dialog) extend this union without touching
 *  the `Action` type. */
export type GestureSpec =
  | KeySpec
  | KeyHeldSpec
  | WheelSpec
  | ClickSpec
  | ContextMenuSpec
  | DragSpec
  | MultiTouchSpec
  | MultiTouchTapSpec;
