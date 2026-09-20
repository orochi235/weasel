// src/tools/types.ts
import type { Op } from '@weasel-js/history';
import type { SelectionApi, View, Bounds, DebugSink, ModifierState } from '../vocabulary';
import type { Contribution } from '../contributions/types';
import type { CursorSpec } from '@weasel-js/cursor';

/**
 * Configurable activation-key descriptor for tools that expose their
 * keybinding to the host (currently Lasso and Eyedropper). Captures
 * only the fields meaningful to a caller-supplied tool-select key —
 * dispatcher-internal fields (`skipInEditable`, `enabled`,
 * `preventDefault`) live on `KeyBinding` in keyHelpers.ts and are
 * not part of the configurable surface.
 */
export interface ToolKeybinding {
  /** Key or list of keys to match (case-insensitive against `event.key`). */
  key: string | readonly string[];
  /** Require Cmd (mac) / Ctrl (others). Default `false`. */
  mod?: boolean;
  /** Require Alt. Default `false`. */
  alt?: boolean;
  /**
   * Shift policy. `undefined`/`false` forbids shift, `true` requires
   * shift, `'optional'` allows either.
   */
  shift?: boolean | 'optional';
}

/** Modifier-key snapshot at event dispatch time. */
export type ToolModifiers = ModifierState;

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
  /** Optional debug sink. When `<Canvas debug={...}>` is enabled, Canvas
   *  threads its sink here so tool-internal hit math (handle hitboxes,
   *  rotation handle, etc.) lands in the same overlay as Canvas's own
   *  bounds/origin records. Tools should call this conditionally with `?.`. */
  debug?: DebugSink;
  scratch: TScratch;
}

/** World-space AABB shape used by `previewBounds`. Alias of the kit-wide
 *  `Bounds` type — the optional `rotation` field carries through so a tool
 *  can report an oriented preview rect (e.g. mid-rotate). */
export type ToolBounds = Bounds;

/**
 * The focus-declaring case of a `Contribution`: a mode the user switches
 * into, plus the hooks that only make sense for one (`initScratch`,
 * activate/deactivate, live preview, `cursor`). Everything else — bindings,
 * actions, overlay, presentation — is inherited.
 */
export interface Tool<TScratch = unknown, TOverlay = unknown> extends Contribution<TOverlay> {
  /** Optional caller-supplied key. Most built-in tools have their activation
   *  key declared in `BUILTIN_SELECT_KEYS` in `useKeybindings.ts`; this field
   *  is for tools that want their activation key to be configurable by the
   *  host (currently Lasso and Eyedropper). The dynamic loop in
   *  `useKeybindings.ts` picks this up and appends a binding entry to the
   *  consolidated `tool.activate` action (with `opts.params.toolId` set so
   *  the invoker knows which tool to switch to). */
  keybinding?: ToolKeybinding;
  initScratch?: () => TScratch;
  cursor?: CursorSpec | ((ctx: ToolCtx<TScratch>) => CursorSpec);
  onActivate?: (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
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
}

/** Internal — which slot a tool occupies in the dispatch order. */
export type ToolSlot = 'hotkey' | 'active' | 'ambient';

/** Internal alias for "a Tool of any scratch type" — used in registries and
 *  dispatchers that hold tools of heterogeneous scratch shapes. `any` is
 *  intentional: `Tool<TScratch>` is invariant in TScratch, so `Tool<unknown>`
 *  is too strict for containers that accept any concrete `Tool<T>`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any, any>;

/** "A tool of any scratch type that draws `TOverlay`" — the container form for
 *  registries that hold heterogeneous scratch shapes but one overlay type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolOf<TOverlay> = Tool<any, TOverlay>;
