// src/tools/types.ts
import type { SelectionApi } from '../features/selection/useSelection';
import type { Op } from '../core/ops/types';
import type { View } from '../features/viewport/view';
import type { RenderLayer } from '../core/layers/render';

/** Outcome of a channel handler. `'claim'` stops dispatch for this event;
 *  `'pass'` lets the next slot try. Handlers that return nothing are
 *  treated as `'pass'`. */
export type Decision = 'claim' | 'pass' | void;

/** Modifier-key snapshot at event dispatch time. `space` is included
 *  because tools commonly use space as a modifier-slot trigger and may
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

/** Modifier-slot trigger key. `null` (or omitted) means the tool is
 *  not eligible for the modifier slot. */
export type ModifierTrigger = 'space' | 'alt' | 'ctrl' | 'meta' | 'shift';

/** World-space AABB shape used by `peekBounds`. Matches the `{x, y, width,
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
  modifier?: ModifierTrigger;
  initScratch?: () => TScratch;
  onActivate?: (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  pointer?: PointerChannel<TScratch>;
  drag?: DragChannel<TScratch>;
  keyboard?: KeyboardChannel<TScratch>;
  wheel?: WheelChannel<TScratch>;
  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
  /** Returns the in-flight overlay pose for `id` if this tool is mid-gesture
   *  on it; otherwise `null`. Lets `Canvas.helpersRef.getEffectivePose`
   *  reflect live overlay state without reaching into hook internals. The
   *  return type is `unknown` here because the Tool interface is pose-agnostic;
   *  callers that know the pose shape (e.g. Canvas typed by `TPose`) cast at
   *  the use site. */
  peekPose?: (id: string) => unknown;
  /** Returns the in-flight overlay bounds for `id` if this tool is mid-gesture
   *  on it; otherwise `null`. Optional companion to `peekPose` for tools that
   *  can compute bounds without round-tripping through a geometry adapter. */
  peekBounds?: (id: string) => ToolBounds | null;
  /** Optional overlay layer rendered on top of the scene/chrome whenever
   *  this tool is in any active slot (active, modifier, or alwaysOn).
   *  The layer's `draw` function reads from this tool's scratch via React
   *  closure (re-evaluated each render). Return early from `draw` to render
   *  nothing — typically gated on a scratch field like
   *  `if (!scratch.overlay) return`. */
  overlay?: RenderLayer<unknown>;
}

/** Internal — which slot a tool occupies in the dispatch order. */
export type ToolSlot = 'modifier' | 'active' | 'alwaysOn';

/** Internal alias for "a Tool of any scratch type" — used in registries and
 *  dispatchers that hold tools of heterogeneous scratch shapes. `any` is
 *  intentional: `Tool<TScratch>` is invariant in TScratch, so `Tool<unknown>`
 *  is too strict for containers that accept any concrete `Tool<T>`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any>;
