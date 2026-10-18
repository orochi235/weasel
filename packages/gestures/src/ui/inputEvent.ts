/** Keyboard/pointer modifier flags carried by every {@link InputEvent} arm. */
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
 * the body relates to the selection. Supplied by the same `classifyTarget`
 * thunk; an absent `bodyKind` makes every `kind:` form no-match, never a
 * wildcard.
 */
export type BodyKind = string;

/**
 * What a scene hit-test found under a point — the shape a `classifyTarget`
 * thunk returns, and the source of both {@link BodyTarget} and
 * {@link BodyKind} on the events the matcher sees.
 */
export interface BodyClassification {
  /** How the hit body relates to the current selection. */
  body: BodyTarget;
  /** Semantic kind of the hit body. Undefined on empty canvas, and undefined
   *  on a body whose kind the scene can't name — never guessed. */
  kind?: BodyKind;
  /** The node classified. Matching ignores it. */
  id?: string;
}

/** A keystroke. */
export interface KeyEvent extends EventModifiers {
  kind: 'key';
  key: string;
  /** `KeyboardEvent.code`, when the source event had one. */
  code?: string;
  repeat?: boolean;
}

/** A held key transitioning down or up (e.g. space-to-pan). */
export interface KeyHeldEvent extends EventModifiers {
  kind: 'key-held';
  key: string;
  /** `KeyboardEvent.code`, when the source event had one. */
  code?: string;
  phase: 'down' | 'up';
}

/** A scroll-wheel / trackpad scroll, with raw deltas and client coords. */
export interface WheelEvent extends EventModifiers {
  kind: 'wheel';
  deltaX: number;
  deltaY: number;
  clientX: number;
  clientY: number;
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/**
 * One sample of a pinch the platform reports as a scale rather than as
 * pointers — WebKit's `gesturechange`, a macOS trackpad pinch in Safari. A
 * touchscreen pinch arrives as pointers and is {@link MultiTouchEvent}.
 */
export interface PinchEvent extends EventModifiers {
  kind: 'pinch';
  /** Scale since the previous sample, as a multiplier: `> 1` spreads, `< 1`
   *  closes. Incremental, so a sample is self-contained like a wheel delta. */
  scale: number;
  /** Rotation since the previous sample, in degrees, clockwise positive. */
  rotation: number;
  /** Focal point, canvas-local like {@link WheelEvent}'s: client coords minus
   *  the canvas's bounding rect. */
  clientX: number;
  clientY: number;
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
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
 * Which physical pointer a sample came from, so the dispatcher can key
 * in-flight gesture handles per pointer. Optional because synthesized events
 * (tests, programmatic drags, the hover pump's `resolveOnly` probe) have no
 * originating `PointerEvent`; those all key to the same default slot.
 */
export interface PointerIdentity {
  /** `PointerEvent.pointerId` from the originating DOM event. */
  pointerId?: number;
}

/** A pointer press — the start of any drag, and the richest event shape. */
export interface PointerDownEvent extends EventModifiers, PointerSampleStylus, PointerIdentity {
  kind: 'pointerdown';
  /**
   * Which of the two dispatches this press produces. A physical pointerdown
   * is dispatched twice:
   *
   * - `'press'` — emitted immediately, at down time. Matches `pointerDown`
   *   specs only.
   * - omitted — the copy the dispatcher buffers and flushes once movement
   *   crosses the drag threshold. Matches `drag` specs only, and is what
   *   opens a drag handle.
   *
   * The split is what keeps one press from firing both a `pointerDown` and a
   * `drag` binding.
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
   */
  x?: number;
  y?: number;
  /**
   * Client/screen-space coordinates of the release, straight off the DOM
   * event. What an action that has to place DOM at the pointer reads, via
   * `InvocationCtx.screen`.
   */
  clientX?: number;
  clientY?: number;
  /**
   * World-space coordinates of the *press* that opened this click, as opposed
   * to `x`/`y`, which are the release. The two differ by up to the
   * drag threshold (`DRAG_THRESHOLD_PX`, in screen pixels). Actions that place
   * geometry at the click want this one: pinning to the press point keeps a
   * snapped coordinate stable against the drift between press and release.
   * Absent when the `clientToWorld` thunk isn't wired, same as `x`/`y`.
   */
  pressX?: number;
  pressY?: number;
  /**
   * Affordance the *press* landed on, carried forward from the pointerdown
   * like {@link ClickEvent.bodyTarget} is. Without this a `kindOf` target on
   * a click spec would receive the raw DOM element while the same predicate
   * on a drag spec receives the affordance.
   */
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/** A double click. `x`/`y` carry the same meaning as on {@link ClickEvent}. */
export interface DoubleClickEvent extends EventModifiers {
  kind: 'doubleclick';
  target?: unknown;
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
  /** Affordance the originating press landed on, replayed from it. */
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/** A context-menu (right-click) request. */
export interface ContextMenuEvent extends EventModifiers {
  kind: 'contextmenu';
  target?: unknown;
  /** World-space position of the request. */
  x?: number;
  y?: number;
  /** Client/screen-space position of the request. A context menu is the
   *  canonical "place DOM at the pointer" case, so this is the one it needs. */
  clientX?: number;
  clientY?: number;
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/** What a hover found under the pointer. */
export interface HoverWhere {
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/** A move of a pointer with no button pressed, or its leaving the surface. Matched by `hover` specs. */
export interface HoverEvent extends EventModifiers {
  kind: 'hover';
  /** What the pointer was over at its last move, when it has made one since coming onto the surface. */
  from?: HoverWhere;
  /** The pointer has left the surface. Where it is and what it is over are its last move's. */
  off?: boolean;
  /** World-space position of the pointer. */
  x: number;
  y: number;
  clientX?: number;
  clientY?: number;
  affordance?: unknown;
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
export interface MultiTouchEvent extends EventModifiers {
  kind: 'multitouch';
  fingers: number;
  /**
   * Centroid of active pointers in **canvas-local** CSS pixels — client
   * coordinates with the canvas's bounding-rect origin already subtracted,
   * which is the space `zoomAt` anchors in. Not client coords, and not world:
   * calling `clientToWorld` on it subtracts the canvas origin a second time.
   *
   * Present on the event a finger landing produces and on each move of a
   * running gesture; absent on the one that ends it.
   */
  centroid?: { x: number; y: number };
  /**
   * Distance between the two primary pointers, in CSS pixels. A distance is
   * origin-free, so it reads the same in client and canvas-local space.
   * Present and absent alongside `centroid`.
   */
  spread?: number;
  /**
   * Direction from the first of the two primary pointers to the second, in
   * degrees in (-180, 180], growing clockwise on screen. Present and absent
   * alongside `centroid`.
   */
  angle?: number;
  /**
   * Set on the event that ends the running multitouch gesture, whatever its
   * finger count: `'commit'` when a finger lifts, `'cancel'` when one of its
   * pointers is canceled. Such an event starts nothing.
   */
  end?: 'commit' | 'cancel';
}

/** A multi-finger tap (no drag). */
export interface MultiTouchTapEvent extends EventModifiers {
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

/** A carry over the canvas (`startCarry`). `stage` is what it did here: came
 *  over, moved, was released, or left — off the surface, or canceled on it. */
export interface CarryEvent extends EventModifiers {
  kind: 'carry';
  stage: 'enter' | 'move' | 'drop' | 'leave';
  pointerId?: number;
  /** The payload's type, which a spec's `types` globs filter, and the payload. */
  type: string;
  value: unknown;
  /** World-space position (post view transform). */
  x: number;
  y: number;
  clientX: number;
  clientY: number;
}

/** External content pasted from the system clipboard. Carries no point. */
export interface PasteEvent extends EventModifiers {
  kind: 'paste';
  items: readonly IngestItem[];
}

/**
 * Normalized input-event shape consumed by the pure matcher. Pump-only events
 * ({@link PointerMoveEvent}, {@link PointerUpEvent}, {@link PointerCancelEvent})
 * ride in the same union so the dispatcher's `handleInput` signature stays
 * uniform; the matcher itself never matches them.
 *
 * The `affordance?` field on {@link PointerDownEvent} is widened to `unknown`
 * in this package — the kit narrows it back to `AffordanceHit` at consumption.
 */
export type InputEvent =
  | KeyEvent
  | KeyHeldEvent
  | WheelEvent
  | PinchEvent
  | PointerDownEvent
  | PointerMoveEvent
  | HoverEvent
  | PointerUpEvent
  | PointerCancelEvent
  | ClickEvent
  | DoubleClickEvent
  | ContextMenuEvent
  | LongPressEvent
  | MultiTouchEvent
  | MultiTouchTapEvent
  | DropEvent
  | CarryEvent
  | PasteEvent;
