/**
 * The primitives the routing surface is typed in.
 *
 * Routing decides which action a gesture runs. To do that it has to name a
 * viewport, a rect, a node id and a selection — but it never constructs,
 * projects or renders any of them. So they are declared here as structural
 * interfaces with no dependencies, and `@weasel-js/core` re-exports each from
 * the path its own call sites have always used. Same arrangement as `Op`,
 * which is declared in `@weasel-js/history` and re-exported by
 * `core/ops/types`.
 *
 * Authority for the *behavior* behind each of these stays in core: `View` is
 * what `core/viewport` maintains, `SelectionApi` is what `useSelection`
 * returns, `DeviceProfile` is what `resolveDeviceProfile` detects. Changing
 * one of these shapes is a change to core's contract that happens to be
 * spelled here.
 */

/** An opaque scene-node identifier. Branded so a bare string cannot stand in. */
export type NodeId = string & { readonly __brand: 'NodeId' };

/**
 * Viewport state. `(view.x, view.y)` is the world point currently rendered at
 * the canvas top-left; `view.scale.x` / `view.scale.y` is pixels per world
 * unit on each axis.
 *
 * The one outright 2D dead end in the routing surface: a `View` names no
 * orientation, so a kernel with a camera cannot express its viewport as one.
 */
export interface View {
  x: number;
  y: number;
  scale: { x: number; y: number };
}

/**
 * Axis-aligned rectangle in world space. The optional `rotation` (radians,
 * around the AABB center) lets chrome attach an orientation to an otherwise
 * axis-aligned rect without a parallel type.
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** Selection click policy. `single` always replaces; `multi` toggles when the
 *  configured extend key is held, otherwise replaces. */
export type SelectionMode = 'single' | 'multi';

/** Modifier key used to extend the selection in `multi` mode. */
export type SelectionExtendKey = 'shift' | 'meta' | 'ctrl';

/** The selection as routing reads and writes it. */
export interface SelectionApi {
  /** Current selection. Re-renders trigger when this reference changes. */
  current: readonly NodeId[];
  /** Imperative read for use inside event callbacks (avoids stale closures). */
  get(): NodeId[];
  /** Replace selection. */
  set(ids: NodeId[]): void;
  /** Add id (multi-mode appends; single-mode replaces). */
  add(id: NodeId): void;
  /** Remove id from selection. */
  remove(id: NodeId): void;
  /** Toggle id in/out of selection. */
  toggle(id: NodeId): void;
  /** Clear selection. */
  clear(): void;
  /** True if id is selected. */
  contains(id: NodeId): boolean;
  /**
   * Apply a click to the selection per the configured mode/extend key.
   * - `single`: replaces selection with `[id]`, regardless of modifiers.
   * - `multi`: with the extend key held, toggles `id` in/out of the selection;
   *   otherwise replaces with `[id]`.
   */
  applyClick(id: NodeId, modifiers: { shift: boolean; meta: boolean; ctrl: boolean }): void;
  /** Pre-built methods for spreading into an adapter that needs them. */
  adapterMethods: {
    getSelection: () => NodeId[];
    setSelection: (ids: NodeId[]) => void;
  };
}

/**
 * Facts about the device the canvas is running on, as the eligibility rules
 * read them (`coarsePointer`, `canHover`). Deliberately not a form-factor
 * concept — there is no `isPhone` here and there should never be one.
 */
export interface DeviceProfile {
  /** `matchMedia('(pointer: coarse)')` — the primary pointer is imprecise. */
  readonly coarsePointer: boolean;
  /** `matchMedia('(hover: hover)')` — the primary pointer can hover. */
  readonly canHover: boolean;
  /** Live device pixel ratio. */
  readonly dpr: number;
  /** Multiplier for handle sizes and hit radii. Derived from `coarsePointer`
   *  unless explicitly overridden. */
  readonly targetScale: number;
}

/** Which kind of handle a recorded hit region belongs to. */
export type HandleKind = 'corner' | 'rotation' | 'anchor';

/** The geometry a hit region actually tests against, as reported to the debug
 *  sink so the overlay can draw the real shape rather than its bounding box. */
export type HitShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rotation?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'path'; d: Path2D };

/**
 * Where a tool reports its internal hit math so the debug overlay can draw it.
 * Routing threads a sink through `ToolCtx` and never calls one.
 */
export interface DebugSink {
  recordHitbox(id: string, kind: 'body' | 'handle' | 'rotation' | 'anchor', shape: HitShape): void;
  recordHandle(id: string, position: { x: number; y: number }, kind: HandleKind): void;
  recordBounds(id: string, bounds: { x: number; y: number; width: number; height: number }): void;
  recordOrigin(id: string, point: { x: number; y: number }): void;
  recordSnapCandidate(point: { x: number; y: number }, accepted: boolean): void;
  recordLayer(id: string, label: string, space: 'world' | 'screen', index: number): void;
  /** Clears every non-snap array. Called at the start of each Canvas render. */
  beginFrame(): void;
  /** Clears the snap array. Called at gesture end. */
  clearSnap(): void;
}

/**
 * Snapshot of modifier-key state at dispatch. Distinct from
 * `EventModifiers` in `@weasel-js/gestures`, which mirrors the DOM's
 * `altKey`/`ctrlKey` spelling; this is the kit-facing one.
 */
export interface ModifierState {
  alt: boolean;
  shift: boolean;
  meta: boolean;
  ctrl: boolean;
}

/** Which edges a resize gesture pins. `free` means the axis is unconstrained. */
export type ResizeAnchor = {
  x: 'min' | 'max' | 'free';
  y: 'min' | 'max' | 'free';
};
