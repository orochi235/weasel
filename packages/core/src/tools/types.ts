// src/tools/types.ts
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { View } from 'core/viewport/view';
import type { RenderLayer } from 'core/layers/render';
import type { DebugSink } from '../debug/types';
import type { ToolKeybinding } from './routing/types';
import type { HitResult } from './routing/hitResult';
import type { RouteResolvedInfo } from './routing/reflection/route-resolved';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { GestureBinding } from '../interactions/actions/binding';
import type { CapabilityTag } from '@weasel-js/modes';

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
  /** Hit-test result for the current event. Populated by the dispatcher
   *  before each handler call. Tools that don't use declarative routing
   *  can ignore this. Optional for migration; will become
   *  required once the routing migration is complete. */
  target?: HitResult;
  selection: SelectionApi;
  /** Adapter/scene access — opaque at this layer; tools that need it
   *  cast to a known shape. This layer doesn't constrain it. */
  adapter: unknown;
  applyOps: (ops: Op[], label: string) => void;
  /** Current viewport. Reflects camera-position semantics — see
   *  `View` JSDoc. */
  view: View;
  /** Mutate the viewport. In controlled mode this calls the consumer's
   *  `onViewChange`; in uncontrolled mode it updates Canvas's internal
   *  state. View changes are not undoable. */
  setView: (next: View) => void;
  /** Bounding rect of the canvas element in viewport coords. Used by
   *  zoom/pan tools to convert event clientX/clientY to canvas-relative
   *  anchors. */
  canvasRect: DOMRect;
  /** Screen-space pointer coords relative to `canvasRect`. Useful for
   *  viewport tools that pan/zoom in screen space (e.g. hand-pan
   *  computes deltas in pixels, not world units). Optional — populated
   *  by the dispatcher on pointer events; absent on keyboard events. */
  screenPoint?: { x: number; y: number };
  /** Optional debug sink. When `<Canvas debug={...}>` is enabled, Canvas
   *  threads its sink here so tool-internal hit math (handle hitboxes,
   *  rotation handle, etc.) lands in the same overlay as Canvas's own
   *  bounds/origin records. Tools should call this conditionally with `?.`. */
  debug?: DebugSink;
  /** Kit-internal: route-resolution reporter. The dispatcher populates
   *  this; the declarative routing factory calls it after each successful
   *  resolveRoute() hit so the dispatcher can publish the last-resolved
   *  snapshot to debug-overlay consumers. Underscore prefix signals
   *  "do not consume in tool code." */
  __reportRoute?: (info: RouteResolvedInfo) => void;
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

/** Hotkey-slot trigger key. The slot is engaged while this key is held —
 *  hence "hotkey": active as long as the key is hot. `null` (or omitted)
 *  means the tool is not eligible for the hotkey slot. */
export type HotkeyTrigger = 'space' | 'alt' | 'ctrl' | 'meta' | 'shift';

/** World-space AABB shape used by `previewBounds`. Alias of the kit-wide
 *  `Bounds` type — the optional `rotation` field carries through so a tool
 *  can report an oriented preview rect (e.g. mid-rotate). */
export type ToolBounds = Bounds;

/** Presentation metadata for tool palettes / menus. Optional on every
 *  tool — consumers that render a palette (`<ToolPalette>`) read these
 *  fields to display the tool; consumers that don't can ignore them.
 *
 *  Note: cursor is NOT here. The top-level `Tool.cursor` field below is
 *  already plumbed through `<Canvas>` to `style.cursor` on the host. */
export interface ToolPresentation<TScratch = unknown> {
  /** Human-readable label, distinct from the `id`. Falls back to `id`. */
  label?: string;
  /** Inline-SVG icon component output. May be a static `ReactNode` or a
   *  function of scratch state (rare; useful for shape-aware affordances). */
  icon?: import('react').ReactNode | ((scratch?: TScratch) => import('react').ReactNode);
  /** Palette grouping key. Tools sharing a group render contiguously
   *  with separators between groups. Free-form string; the kit
   *  recommends 'select' | 'shape' | 'draw' | 'type' | 'view'. */
  group?: string;
  /** Display override for the keyboard shortcut. When omitted the palette
   *  derives one from `Tool.keybinding` via its own formatter. */
  shortcut?: string;
}

/** Full Tool record. */
export interface Tool<TScratch = unknown> {
  id: string;
  /**
   * App-level capability tags for modality. The `weasel-modes` package's
   * `eligibleForMode(mode, capabilities)` predicate consumes these to decide
   * whether the tool is usable in the active mode. Tags are extensible
   * strings — apps can define their own. Untagged tools are treated as
   * ineligible by all modes except those whose `allows` list includes
   * every implicit-or-declared tag (i.e. `normal` in the default preset).
   */
  capabilities?: CapabilityTag[];
  /**
   * Actions this tool owns and needs registered while it is in the tools
   * registry — e.g. polygon's `polygon.adjustSides`, which its own bindings
   * reference by id.
   *
   * Declared here rather than registered by the hook with `useAction`,
   * because tool hooks run wherever the consumer calls them — for
   * `<SceneCanvas>` that is ABOVE `<ActionsProviderIfRoot>`, where
   * `useActionsRegistry()` returns null and `useAction` silently no-ops. The
   * result was a binding pointing at an action id nothing had registered, so
   * the gesture fell through to whatever matched next (polygon's
   * wheel/arrow-key side adjustment did nothing and `nudge.*` moved the
   * selection instead). `<ToolActionsMounter>` registers these from inside
   * the provider.
   */
  actions?: import('interactions/actions/registry').Action[];
  /** Optional caller-supplied key. Most built-in tools have their activation
   *  key declared in `BUILTIN_SELECT_KEYS` in `useKeybindings.ts`; this field
   *  is for tools that want their activation key to be configurable by the
   *  host (currently Lasso and Eyedropper). The dynamic loop in
   *  `useKeybindings.ts` picks this up and appends a binding entry to the
   *  consolidated `tool.activate` action (with `opts.params.toolId` set so
   *  the invoker knows which tool to switch to). */
  keybinding?: ToolKeybinding;
  initScratch?: () => TScratch;
  onActivate?: (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  pointer?: PointerChannel<TScratch>;
  drag?: DragChannel<TScratch>;
  keyboard?: KeyboardChannel<TScratch>;
  wheel?: WheelChannel<TScratch>;
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
  /** Presentation metadata for tool palettes. See `ToolPresentation`. */
  presentation?: ToolPresentation<TScratch>;
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
  /** Declarative gesture-bindings the
   *  dispatcher consults while this tool is active. Empty/undefined keeps
   *  legacy imperative-channel behavior. See
   *  `docs/superpowers/specs/2026-05-16-registry-unification-design.md`. */
  bindings?: GestureBinding[];
  /**
   * Optional. When set, the dispatcher consults this before its built-in
   * node/empty hit-test. If it returns a value, that target replaces the
   * default `target` on the routed action's ctx. The string `target` is
   * the tool's own vocabulary — the dispatcher does not interpret it.
   *
   * Used for tools that need richer sub-object hit categories (e.g., pen
   * edit-mode's anchor/handle/segment vs the default node/empty).
   */
  hitOverride?(ctx: {
    worldX: number;
    worldY: number;
    scratch: TScratch;
    view: View;
    modifiers: ToolModifiers;
  }): { target: string; extra?: unknown } | null;
  /** Reflection escape hatch: when this `Tool` was produced by `defineTool`,
   *  the source `ToolDef` is attached here so introspection consumers
   *  (`buildActionRegistry`, `findConflicts`, the toolkit-builder UI, the
   *  reflection demo) can walk the declarative source rather than the
   *  translated runtime channels. Tools constructed without `defineTool`
   *  may leave this undefined. Typed as `unknown` to keep this file from
   *  importing the routing types — consumers cast at the use site. */
  def?: unknown;
}

/** Internal — which slot a tool occupies in the dispatch order. */
export type ToolSlot = 'hotkey' | 'active' | 'ambient';

/** Internal alias for "a Tool of any scratch type" — used in registries and
 *  dispatchers that hold tools of heterogeneous scratch shapes. `any` is
 *  intentional: `Tool<TScratch>` is invariant in TScratch, so `Tool<unknown>`
 *  is too strict for containers that accept any concrete `Tool<T>`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any>;
