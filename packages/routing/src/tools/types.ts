// src/tools/types.ts
import type { Op } from '@weasel-js/history';
import type { SelectionApi, View, Bounds, DebugSink, ModifierState } from '../vocabulary';
import type { Contribution } from '../contributions/types';
import type { CursorSpec } from '@weasel-js/cursor';
import type { KernelOverlay } from '../index';

/**
 * A tool's activation key, as `ToolDef.keybinding` declares it. Captures
 * only the fields meaningful to a tool-select key —
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

/**
 * What `onActivate` / `onDeactivate` receive: the tool's scratch, from
 * `initScratch()`. A lifecycle moment has no pointer, hit or modifier state to
 * report, so nothing else is populated; a callback needing the selection or
 * the scene closes over it, as the tool's actions do.
 */
export interface ToolLifecycleCtx<TScratch = unknown> {
  scratch: TScratch;
}

/** Alias of the kit-wide `Bounds` type. */
export type ToolBounds = Bounds;

/**
 * The focus-declaring case of a `Contribution`: a mode the user switches
 * into, plus the hooks that only make sense for one (`initScratch`,
 * activate/deactivate, `cursor`). Everything else — bindings,
 * actions, overlay, presentation — is inherited.
 */
export interface Tool<TScratch = unknown, TOverlay = KernelOverlay> extends Contribution<TOverlay> {
  /** The key that activates this tool. `useKeybindings` appends a binding
   *  entry for it to the consolidated `tool.activate` action (with
   *  `opts.params.toolId` set so the invoker knows which tool to switch to).
   *  A tool with none has no activation key. */
  keybinding?: ToolKeybinding;
  initScratch?: () => TScratch;
  cursor?: CursorSpec | ((ctx: ToolCtx<TScratch>) => CursorSpec);
  /** The tool became live: it took the active slot, or its `hotkey` went
   *  down, while it held neither. */
  onActivate?: (ctx: ToolLifecycleCtx<TScratch>) => void;
  /** The tool stopped being live in both slots, or its canvas unmounted. */
  onDeactivate?: (ctx: ToolLifecycleCtx<TScratch>) => void;
}

/** Whether `entry` is a tool: a contribution that can hold focus, chosen from
 *  a palette or held on a key. Only a tool's focus hooks (`initScratch`,
 *  `cursor`, `onActivate`) ever run. */
export function isTool<TOverlay>(entry: Contribution<TOverlay>): entry is Tool<unknown, TOverlay> {
  return !!(entry.eligibility?.focus || entry.eligibility?.offhand);
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
