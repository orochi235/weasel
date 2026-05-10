// src/tools/types.ts
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { View } from 'core/viewport/view';
import type { RenderLayer } from 'core/layers/render';
import type { DebugSink } from '../debug/types';

/** Outcome of a channel handler. `'claim'` stops dispatch for this event;
 *  `'pass'` lets the next slot try. Handlers that return nothing are
 *  treated as `'pass'`. */
export type Decision = 'claim' | 'pass' | void;

/** Modifier-key snapshot at event dispatch time. `space` is included
 *  because tools commonly use space as a hotkey-slot trigger and may
 *  also want to read it as a flag mid-gesture. */
export interface ToolModifiers {
  alt: boolean;
  shift: boolean;
  meta: boolean;
  ctrl: boolean;
  space: boolean;
}

/** Per-event context passed to every channel handler. `scratch` is typed
 *  via the tool's `TScratch` parameter; it survives across a single
 *  gesture (pointer-down through end/cancel) and is replaced on next
 *  gesture start by `initScratch()`. */
export interface ToolCtx<TScratch = unknown> {
  worldX: number;
  worldY: number;
  modifiers: ToolModifiers;
  selection: SelectionApi;
  /** Adapter/scene access — opaque at this layer; tools that need it
   *  cast to a known shape. Phase 1 doesn't constrain this. */
  adapter: unknown;
  applyBatch: (ops: Op[], label: string) => void;
  /** Current viewport. Reflects camera-position semantics — see
   *  `View` JSDoc. Phase 2b is pan-only. */
  view: View;
  /** Mutate the viewport. In controlled mode this calls the consumer's
   *  `onViewChange`; in uncontrolled mode it updates Canvas's internal
   *  state. View changes are not undoable. */
  setView: (next: View) => void;
  /** Bounding rect of the canvas element in viewport coords. Used by
   *  zoom/pan tools to convert event clientX/clientY to canvas-relative
   *  anchors. */
  canvasRect: DOMRect;
  /** Optional debug sink. When `<Canvas debug={...}>` is enabled, Canvas
   *  threads its sink here so tool-internal hit math (handle hitboxes,
   *  rotation handle, etc.) lands in the same overlay as Canvas's own
   *  bounds/origin records. Tools should call this conditionally with `?.`. */
  debug?: DebugSink;
  scratch: TScratch;
}

export interface PointerChannel<TScratch> {
  onDown?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
  onClick?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
}

export interface DragChannel<TScratch> {
  onStart?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
  onMove?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
  onEnd?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
  onCancel?: (ctx: ToolCtx<TScratch>) => void;
}

export interface KeyboardChannel<TScratch> {
  onDown?: (e: KeyboardEvent, ctx: ToolCtx<TScratch>) => Decision;
  onUp?: (e: KeyboardEvent, ctx: ToolCtx<TScratch>) => Decision;
}

export interface WheelChannel<TScratch> {
  onWheel?: (e: WheelEvent, ctx: ToolCtx<TScratch>) => Decision;
}

/** Double-tap (double-click) channel. Fires on the pointerup of the second
 *  sub-threshold tap when it follows a previous sub-threshold tap within the
 *  dispatcher's `dblTap.windowMs` and `dblTap.maxDistance` (CSS px). The
 *  scratch handed to the handler is fresh — `dblTap` is not part of a drag
 *  pipeline, so `initScratch()` runs immediately before the call. A `'claim'`
 *  return suppresses the regular `pointer.onClick` for this gesture. */
export interface DblTapChannel<TScratch> {
  onTap?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
}

/** Hotkey-slot trigger key. The slot is engaged while this key is held —
 *  hence "hotkey": active as long as the key is hot. `null` (or omitted)
 *  means the tool is not eligible for the hotkey slot. */
export type HotkeyTrigger = 'space' | 'alt' | 'ctrl' | 'meta' | 'shift';

/** World-space AABB shape used by `previewBounds`. Matches the `{x, y, width,
 *  height}` shape used throughout the canvas/tools layers. Inlined here to
 *  avoid an import cycle from `tools/types` into `tools/builtin`. */
export interface ToolBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Full Tool record. */
export interface Tool<TScratch = unknown> {
  id: string;
  keybinding?: string;
  hotkey?: HotkeyTrigger;
  initScratch?: () => TScratch;
  onActivate?: (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  pointer?: PointerChannel<TScratch>;
  drag?: DragChannel<TScratch>;
  keyboard?: KeyboardChannel<TScratch>;
  wheel?: WheelChannel<TScratch>;
  /** Double-tap channel — fires when two sub-threshold taps land within
   *  `dblTap.windowMs` / `dblTap.maxDistance` of each other. Lets tools
   *  enter modal modes (e.g. select → edit-anchors) without consumers
   *  attaching `onDoubleClick` to a wrapper DOM node. */
  dblTap?: DblTapChannel<TScratch>;
  /**
   * State-aware predicate. When true, this tool claims every pointerdown
   * and bypasses the affordance layer hit-test pipeline. Used by tools
   * in modal states (pen mid-path, text mid-edit) where affordance hits
   * would otherwise interrupt the in-progress gesture.
   *
   * Default: undefined (treated as false). Called once per pointerdown
   * with the tool's current ctx (scratch + view + modifiers).
   */
  claimsAll?: (ctx: ToolCtx<TScratch>) => boolean;
  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
  /** Returns the in-flight preview pose for `id` if this tool is mid-gesture
   *  on it; otherwise `null`. Lets `Canvas.helpersRef.getEffectivePose`
   *  reflect live gesture state without reaching into hook internals. The
   *  return type is `unknown` here because the Tool interface is pose-agnostic;
   *  callers that know the pose shape (e.g. Canvas typed by `TPose`) cast at
   *  the use site. */
  previewPose?: (id: string) => unknown;
  /** Returns the in-flight preview bounds for `id` if this tool is mid-gesture
   *  on it; otherwise `null`. Optional companion to `previewPose` for tools that
   *  can compute bounds without round-tripping through a geometry adapter. */
  previewBounds?: (id: string) => ToolBounds | null;
  /** Returns ids whose committed scene-render should be suppressed while this
   *  tool is mid-gesture (e.g. cascade move's dragged + descendant ids whose
   *  preview ghosts replace the committed pose). The standard scene slot
   *  consults this alongside `previewPose` to avoid double-rendering. Returns
   *  `null` when no gesture is in flight. */
  previewIds?: () => Iterable<string> | null;
  /** Optional overlay layer rendered on top of the scene/chrome whenever
   *  this tool is in any active slot (active, hotkey, or ambient).
   *  The layer's `draw` function reads from this tool's scratch via React
   *  closure (re-evaluated each render). Return early from `draw` to render
   *  nothing — typically gated on a scratch field like
   *  `if (!scratch.overlay) return`. */
  overlay?: RenderLayer<unknown>;
}

/** Internal — which slot a tool occupies in the dispatch order. */
export type ToolSlot = 'hotkey' | 'active' | 'ambient';

/** Internal alias for "a Tool of any scratch type" — used in registries and
 *  dispatchers that hold tools of heterogeneous scratch shapes. `any` is
 *  intentional: `Tool<TScratch>` is invariant in TScratch, so `Tool<unknown>`
 *  is too strict for containers that accept any concrete `Tool<T>`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any>;
