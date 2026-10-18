/** GestureSpec — describes the form of a user input event that can fire an action. */

/** Optional modifier-key requirement for a gesture spec.
 *
 *  Matching is strict: an omitted modifier field means the modifier MUST NOT
 *  be held — a bare `{ kind: 'key', key: 'Escape' }` matches only unmodified
 *  Escape, NOT Cmd+Escape. A `true` means the modifier MUST be held; `false`
 *  is the same as omitted.
 *
 *  `mod` is a platform-aware shorthand: matches `metaKey` on mac, `ctrlKey`
 *  elsewhere.
 *
 *  Every modifier additionally accepts `'optional'`, meaning "held or not,
 *  both acceptable" — used by actions like nudge whose step size depends on
 *  shift but whose firing does not.
 */
export type ModSpec = Partial<{
  alt: boolean | 'optional';
  ctrl: boolean | 'optional';
  meta: boolean | 'optional';
  mod: boolean | 'optional';
  shift: boolean | 'optional';
}>;

/** The predicate form of {@link TargetSpec}. `hit` is the affordance hit
 *  under the pointer, for every gesture kind; `bodyTarget` is the optional
 *  body-class string ('empty' | 'selected-body' | 'unselected-body') when
 *  `classifyTarget` is wired. Build one with `hitPredicate` or
 *  `bodyPredicate`, which make the declaration below. */
export interface TargetPredicate {
  (hit: unknown, bodyTarget?: string): boolean;
  /** Whether the predicate reads `hit`. An exclusive affordance claim bars
   *  every binding whose target does not: `false` is a predicate that decides
   *  from `bodyTarget` alone, and chrome over a body must not read as that body. */
  readsAffordance: boolean;
}

/** A {@link TargetPredicate} that reads the affordance hit, alone or with the
 *  body class, so it stays in contention under an exclusive claim. */
export function hitPredicate(
  fn: (hit: unknown, bodyTarget?: string) => boolean,
): TargetPredicate & { readsAffordance: true } {
  return Object.assign(
    (hit: unknown, bodyTarget?: string): boolean => fn(hit, bodyTarget),
    { readsAffordance: true as const },
  );
}

/** A {@link TargetPredicate} that decides from the body class alone, so an
 *  exclusive affordance claim bars it. */
export function bodyPredicate(
  fn: (bodyTarget: string | undefined) => boolean,
): TargetPredicate & { readsAffordance: false } {
  return Object.assign(
    (_hit: unknown, bodyTarget?: string): boolean => fn(bodyTarget),
    { readsAffordance: false as const },
  );
}

/** Target selector for click and drag gesture specs. Consumers can pass
 *  `{ kindOf: predicate }` to classify hits themselves.
 *
 *  Adding a form here is a compile error in `parseTargetSpec` until
 *  `TargetSpecForm` grows a matching variant — which is in turn a compile
 *  error at every site that switches on one. */
export type TargetSpec =
  | 'empty'
  | 'selected-body'
  | 'unselected-body'
  | `kind:${string}`
  | `kind:${string}:selected`
  | `affordance:${string}`
  | { kindOf: TargetPredicate };

/** Phase qualifier on a gesture spec. Restricts when the spec matches based
 *  on per-tool gesture-lifecycle state. When omitted, matches in any phase.
 *
 *  Shorthand forms gate on the binding's own tool:
 *    `'engaged'` → `[{ channel: '&', phase: 'engaged' }]`  // self mid-gesture
 *    `'initial'` → `[{ channel: '&', phase: 'initial' }]`  // self idle
 *    `'*'`       → `[{ channel: '&', phase: '*' }]`        // either self phase
 *
 *  Array form for explicit channel:phase atoms — e.g. `[{ channel: 'rect',
 *  phase: 'engaged' }]` for "when the rect tool is mid-gesture, regardless of
 *  which scope I'm in." */
export type PhaseSpec = 'initial' | 'engaged' | '*' | readonly import('../grammar/routeGrammar').PhaseAtom[];

/** Single-keystroke gesture (keydown). */
export interface KeySpec {
  kind: 'key';
  /** A single key, or an array of acceptable keys (case-insensitive match). */
  key: string | string[];
  /** The physical key, as `KeyboardEvent.code` (`'BracketRight'`), or several.
   *  Tried before `key`, and either matching is enough: the binding then holds
   *  on that key whatever a layout or a held modifier makes it type, and still
   *  on any key that types `key`. `key` is what a route names the binding by. */
  code?: string | string[];
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** Key-held gesture (keydown opens, keyup closes). Drives "hold space for
 *  hand tool"-style interactions. */
export interface KeyHeldSpec {
  kind: 'key-held';
  /** A single key, or an array of acceptable keys (case-insensitive match). */
  key: string | string[];
  /** The physical key or keys, as on {@link KeySpec.code}. */
  code?: string | string[];
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** Wheel-event gesture. `direction` filters by deltaY sign: `'up'` matches
 *  only deltaY < 0, `'down'` only deltaY > 0, and the default `'*'` either. */
export interface WheelSpec {
  kind: 'wheel';
  direction?: 'up' | 'down' | '*';
  target?: TargetSpec;
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** Pinch reported as a scale factor about a focal point (WebKit
 *  `gesturechange`). `direction` filters by the sample's scale: `'out'` is
 *  scale > 1, `'in'` is scale < 1; default `'*'`. A touchscreen pinch is
 *  {@link MultiTouchSpec}, not this. */
export interface PinchSpec {
  kind: 'pinch';
  direction?: 'in' | 'out' | '*';
  target?: TargetSpec;
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

/** Double-click: two `click` events within 600ms and 8px of each other.
 *  Synthesized by `useGestureDispatcher`; emitted AFTER the second `click`. */
export interface DoubleClickSpec {
  kind: 'doubleClick';
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

/**
 * Bare pointer press, matched at down time — before the dispatcher knows
 * whether the gesture will become a click or a drag. Reach for this only when
 * the effect must be visible while the button is still held; anything that
 * can wait for the release belongs on a `click` spec, which does not fire on
 * a press that turns into a drag.
 *
 * A matching binding does NOT own the gesture: the same press goes on to open
 * a drag or synthesize a click as usual. Bind an immediate action here, not an
 * ongoing one.
 */
export interface PointerDownSpec {
  kind: 'pointerDown';
  target?: TargetSpec;
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/**
 * The pointer moving over the surface with no button pressed. Fires on every
 * such move; a held pointer's moves belong to its drag and fire nothing here.
 *
 * With `motion: 'leave'` it fires instead when the pointer passes out of what
 * the binding targets: onto something its `target` does not match, or off the
 * surface. With no `target` that is the whole surface. Its params are the
 * move's that took the pointer out, or the last move's before it left the surface.
 *
 * A hover binding claims nothing. Every live binding that matches the move
 * runs, not only the best one, and the move still reaches the hover-cursor
 * pump. There is no press to own, so bind an immediate action, not an ongoing
 * one. Its params carry `worldX` / `worldY`, `clientX` / `clientY`,
 * `affordance`, `bodyTarget`, and `mods`.
 */
export interface HoverSpec {
  kind: 'hover';
  motion?: 'move' | 'leave';
  target?: TargetSpec;
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/**
 * Press held past the long-press threshold without crossing the drag
 * threshold. Synthesized by `useGestureDispatcher` from the pointer stream.
 * Fires for `touch` and `pen` pointers only: a mouse held still is an
 * ordinary slow click.
 *
 * When a long-press matches no binding, the dispatcher re-dispatches it as a
 * `contextmenu` event, so `contextMenu` bindings work under a finger.
 */
export interface LongPressSpec {
  kind: 'longPress';
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
 *  together without movement past the tap threshold, sooner than a long-press
 *  would fire. Synthesized by the dispatcher from the underlying multitouch
 *  tracking. */
export interface MultiTouchTapSpec {
  kind: 'multiTouchTap';
  fingers: number;
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** OS drag-and-drop of external content onto the canvas. `types` filters by
 *  MIME glob (`'image/*'`, `'text/plain'`); the spec matches when ANY item's
 *  MIME matches ANY glob. Omitted or empty = matches any drop. */
export interface DropSpec {
  kind: 'drop';
  types?: string[];
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/**
 * A press that began elsewhere on the page, carried over the canvas: a palette
 * item dragged in, a row dragged out of a list. The in-app sibling of
 * {@link DropSpec}, which is the OS's drag. A carry is begun with `startCarry`.
 * `types` filters by the payload's `type`, as globs; omitted or empty matches
 * any carry.
 *
 * An ongoing action bound here starts when the carry comes over the surface:
 * its moves update it, the release commits it, and leaving the surface or
 * canceling the press cancels it. An immediate action fires once, on the
 * release.
 */
export interface CarrySpec {
  kind: 'carry';
  types?: string[];
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** System-clipboard paste of external content. Same `types` semantics as
 *  {@link DropSpec} — omitted or empty = matches any paste. */
export interface PasteSpec {
  kind: 'paste';
  types?: string[];
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** The full union of supported gesture spec kinds. */
export type GestureSpec =
  | KeySpec
  | KeyHeldSpec
  | WheelSpec
  | PinchSpec
  | ClickSpec
  | DoubleClickSpec
  | ContextMenuSpec
  | DragSpec
  | PointerDownSpec
  | HoverSpec
  | LongPressSpec
  | MultiTouchSpec
  | MultiTouchTapSpec
  | DropSpec
  | CarrySpec
  | PasteSpec;
