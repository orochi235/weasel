/**
 * Keyboard/pointer modifier flags carried by every {@link InputEvent} arm.
 * Factored out so the four booleans are documented once instead of repeated
 * on all twelve event shapes.
 */
export interface EventModifiers {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * Body-target classification from the scene hit-test. Populated by
 * `useGestureDispatcher` when a `classifyTarget` thunk is supplied to its
 * options, and read by `matchTarget` to resolve string-form `TargetSpec`
 * values. Absent when `classifyTarget` is not wired.
 */
export type BodyTarget = 'empty' | 'selected-body' | 'unselected-body';

/**
 * Semantic kind of the node body under the point — `'text'`, `'rect'`, or an
 * app's own `'app:note'`. Companion to {@link BodyTarget}, which says only how
 * the body relates to the selection; this says *what it is*. Read by
 * `matchTarget` to resolve the `kind:<k>` / `kind:<k>:selected` TargetSpec
 * forms.
 *
 * Supplied by the same `classifyTarget` thunk that supplies `bodyTarget`, and
 * absent for the same reasons plus one more: the thunk hit a body whose kind
 * the scene can't name. An absent `bodyKind` makes every `kind:` form
 * no-match, never a wildcard.
 */
export type BodyKind = string;

/**
 * What a scene hit-test found under a point — the shape a `classifyTarget`
 * thunk returns, and the source of both {@link BodyTarget} and
 * {@link BodyKind} on the events the matcher sees.
 *
 * One thunk returns both halves rather than two thunks returning one each:
 * the two answers come from the same hit-test, and splitting them would cost
 * a second pick on every pointer event.
 */
export interface BodyClassification {
  /** How the hit body relates to the current selection. */
  body: BodyTarget;
  /** Semantic kind of the hit body. Undefined on empty canvas, and undefined
   *  on a body whose kind the scene can't name — never guessed. */
  kind?: BodyKind;
}

/** A keystroke. */
export interface KeyEvent extends EventModifiers {
  kind: 'key';
  key: string;
  repeat?: boolean;
}

/** A held key transitioning down or up (e.g. space-to-pan). */
export interface KeyHeldEvent extends EventModifiers {
  kind: 'key-held';
  key: string;
  phase: 'down' | 'up';
}

/** A scroll-wheel / trackpad scroll, with raw deltas and client coords. */
export interface WheelEvent extends EventModifiers {
  kind: 'wheel';
  deltaX: number;
  deltaY: number;
  clientX: number;
  clientY: number;
}

/**
 * Stylus state carried alongside a pointer sample. Every field is optional:
 * the values come straight off the originating `PointerEvent`, and callers
 * that synthesize events (tests, programmatic drags) omit them.
 *
 * Mouse and ordinary touch report `pressure: 0.5` while a button is held
 * and `0` otherwise, per the Pointer Events spec — a consumer that wants
 * stylus-only modulation should gate on real pressure variance rather than
 * on presence of the field.
 */
export interface PointerSampleStylus {
  /** 0..1. */
  pressure?: number;
  /** Degrees, ±90. Zero for mouse/touch. */
  tiltX?: number;
  /** Degrees, ±90. Zero for mouse/touch. */
  tiltY?: number;
}

/**
 * Which physical pointer a sample came from.
 *
 * Carried by every pointer-kind event so the dispatcher can key in-flight
 * gesture handles per pointer (`pointer-<pointerId>`) instead of funneling
 * mouse, each touch, and the stylus into one slot. Optional because
 * synthesized events (tests, programmatic drags, the hover pump's
 * `resolveOnly` probe) have no originating `PointerEvent`; those all key to
 * the same default slot, which is the pre-`pointerId` behavior.
 */
export interface PointerIdentity {
  /** `PointerEvent.pointerId` from the originating DOM event. */
  pointerId?: number;
}

/** A pointer press — the start of any drag, and the richest event shape. */
export interface PointerDownEvent extends EventModifiers, PointerSampleStylus, PointerIdentity {
  kind: 'pointerdown';
  /**
   * Which of the two dispatches this press produces.
   *
   * A physical pointerdown is dispatched twice, for two different audiences:
   *
   * - `'press'` — emitted immediately, at down time. Matches `pointerDown`
   *   specs only. This is the dispatch that lets a binding act *before* the
   *   gesture is classified (select applies the selection here, so
   *   press-and-hold highlights without waiting for a release).
   * - omitted — the copy the dispatcher buffers and flushes once movement
   *   crosses the drag threshold. Matches `drag` specs only, and is what
   *   opens a drag handle.
   *
   * The split is what keeps one press from firing both a `pointerDown` and a
   * `drag` binding. Synthetic probes (the hover pump's `resolveOnly`) leave it
   * omitted, so drag prediction is unaffected.
   */
  stage?: 'press';
  target?: unknown;
  /** World-space coordinates (post view transform). */
  x?: number;
  y?: number;
  /**
   * Client/screen-space coordinates (raw DOM event). Required for any drag
   * action whose effect mutates the view itself — world coords shift
   * mid-gesture and produce self-referential deltas.
   */
  clientX?: number;
  clientY?: number;
  /** Generic affordance payload (the kit narrows this to `AffordanceHit`). */
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/** A pump-only pointer move. Carried in the union so the dispatcher's
 *  `handleInput` signature stays uniform; the matcher never matches it. */
export interface PointerMoveEvent extends EventModifiers, PointerSampleStylus, PointerIdentity {
  kind: 'pointermove';
  x: number;
  y: number;
  clientX?: number;
  clientY?: number;
}

/** A pump-only pointer release. Not matched by the matcher. */
export interface PointerUpEvent extends EventModifiers, PointerIdentity {
  kind: 'pointerup';
  x: number;
  y: number;
  clientX?: number;
  clientY?: number;
}

/** A pump-only pointer cancel. Not matched by the matcher. */
export interface PointerCancelEvent extends EventModifiers, PointerIdentity {
  kind: 'pointercancel';
}

/** A click (down+up on the same target). */
export interface ClickEvent extends EventModifiers {
  kind: 'click';
  target?: unknown;
  /**
   * World-space coordinates of the click, derived via the `clientToWorld`
   * thunk supplied to the dispatcher. Absent when the thunk isn't wired.
   * Forwarded into action params so click invokers can act on the click's
   * position without their own pointer-listener plumbing.
   */
  worldX?: number;
  worldY?: number;
  /**
   * World-space coordinates of the *press* that opened this click, as opposed
   * to `worldX`/`worldY`, which are the release. The two differ by up to the
   * drag threshold (4px screen).
   *
   * Actions that place geometry at the click want this one — a click's
   * location reads as where the user put the pointer down, and pinning to the
   * press point keeps a snapped coordinate stable against the small drift
   * between press and release. Absent when the `clientToWorld` thunk isn't
   * wired, same as `worldX`/`worldY`.
   */
  pressX?: number;
  pressY?: number;
  /**
   * Affordance the *press* landed on, carried forward from the pointerdown
   * exactly like {@link ClickEvent.bodyTarget} is. A click's target is
   * whatever the press hit — chrome doesn't move out from under a pointer
   * between down and up — and without this a `kindOf` target on a click spec
   * would receive the raw DOM element while the same predicate on a drag spec
   * receives the affordance.
   */
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/** A double click. `worldX`/`worldY` carry the same meaning as on {@link ClickEvent}. */
export interface DoubleClickEvent extends EventModifiers {
  kind: 'doubleclick';
  target?: unknown;
  worldX?: number;
  worldY?: number;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/** A context-menu (right-click) request. */
export interface ContextMenuEvent extends EventModifiers {
  kind: 'contextmenu';
  target?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/** A press held past the long-press threshold without moving. */
export interface LongPressEvent extends EventModifiers {
  kind: 'longpress';
  target?: unknown;
  /** World-space position of the originating press. */
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
  /** Affordance hit at press time, if any — lets a binding long-press a
   *  resize handle, not just body. */
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/** A running multitouch gesture (e.g. pinch/rotate). */
export interface MultitouchEvent extends EventModifiers {
  kind: 'multitouch';
  fingers: number;
  /**
   * Centroid of active pointers in screen space. Populated by
   * `useGestureDispatcher` on the pointermove-pump of a running multitouch
   * handle (updated each frame). Absent on the initial pointerdown-triggered
   * multitouch event.
   */
  centroid?: { x: number; y: number };
  /**
   * Distance between the two primary pointers (screen space). Populated on
   * move-pump events alongside `centroid`. Absent on the initial event.
   */
  spread?: number;
}

/** A multi-finger tap (no drag). */
export interface MultitouchTapEvent extends EventModifiers {
  kind: 'multitouchtap';
  fingers: number;
}

/**
 * One piece of external content arriving via OS drop, clipboard paste, or a
 * file picker — fully materialized (string contents already read), so it is
 * safe to hold past the originating DOM event. `File` is a lib.dom type;
 * no runtime DOM dependency.
 */
export type IngestItem =
  | { kind: 'file'; mime: string; file: File }
  | { kind: 'string'; mime: string; text: string };

/** External content dropped onto the canvas (OS drag-and-drop). */
export interface DropEvent extends EventModifiers {
  kind: 'drop';
  items: readonly IngestItem[];
  /** World-space drop point (post view transform). */
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
}

/** External content pasted from the system clipboard. Carries no point. */
export interface PasteEvent extends EventModifiers {
  kind: 'paste';
  items: readonly IngestItem[];
}

/**
 * Normalized input-event shape consumed by the pure matcher. Built by the
 * React seam (`useGestureDispatcher`) from DOM events. Pump-only events
 * ({@link PointerMoveEvent}, {@link PointerUpEvent}, {@link PointerCancelEvent})
 * ride in the same union so the dispatcher's `handleInput` signature stays
 * uniform; the matcher itself never matches them.
 *
 * The `affordance?` field on {@link PointerDownEvent} is widened to `unknown`
 * in this package — the kit narrows it back to `AffordanceHit` at consumption.
 * This keeps `@weasel-js/gestures` free of any kit-affordance type.
 */
export type InputEvent =
  | KeyEvent
  | KeyHeldEvent
  | WheelEvent
  | PointerDownEvent
  | PointerMoveEvent
  | PointerUpEvent
  | PointerCancelEvent
  | ClickEvent
  | DoubleClickEvent
  | ContextMenuEvent
  | LongPressEvent
  | MultitouchEvent
  | MultitouchTapEvent
  | DropEvent
  | PasteEvent;
