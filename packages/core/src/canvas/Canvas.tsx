/**
 * Low-level WebGL surface + viewport + pointer routing primitive.
 * Composes layers into a single GL render pass, applies a view transform,
 * routes pointer/keyboard events to the supplied `tools.dispatcher`, and
 * exposes scene-agnostic slot props (`backgroundFill`, `cursorCoordsHud`,
 * `pickHud`).
 *
 * Canvas owns NO scene-shaped state — selection, picking, kind registry,
 * scene-aware overlays — all live in `<SceneCanvas>` (the public consumer
 * entry point) which wraps `<Canvas>`.
 *
 * The `layers` prop is a map keyed by slot name. Standard slots render at a
 * canonical position; custom entries (any other key, value carrying `.layer`)
 * insert at `after`/`before` an existing slot, defaulting to the top.
 *
 * @internal
 * @deprecated Bare `<Canvas>` is not a supported consumer surface.
 *   Use `<SceneCanvas>` instead. Re-promotion is tracked in
 *   `docs/TODO.md`.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { FillStyle } from 'core/paint-types';
import { composeOrderedLayers, placeToolOverlays } from './layerOrder';
import {
  STANDARD_SLOTS,
  isCustomEntry,
  type CustomLayerEntry,
} from './layerSlots';
export { STANDARD_SLOTS, isCustomEntry } from './layerSlots';
export type { StandardSlotName, CustomLayerEntry } from './layerSlots';
import type { CanvasExtensionApi } from './canvasExtension';
import type { ToolsApi } from 'tools/useTools';
import { firstPreviewPose, firstPreviewBounds, aggregatePreviewIds } from './toolPreview';
import { unionGestureBounds, type GestureSource } from './gestureBounds';

import type { ToolCtx } from 'tools/types';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { NodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { clampView } from 'core/viewport/clampView';
import { clientToWorld as clientToWorldHelper } from 'core/viewport/clientToWorld';
import { drawLayers, type Dims, type RenderLayer } from 'core/layers/render';
import { WeaselRenderer, viewToMat3, type DrawCommand, type ShaderProgramHandle } from '../renderer';
import {
  type SelectionApi,
} from 'core/selection/useSelection';
import { buildChromeState, type ChromeState } from 'core/selection/chromeState';
import type {
  MoveAdapter,
  ResizeAdapter,
  RotateAdapter,
} from 'core/adapters/types';
import { createGridLayer, type GridLayerOpts } from 'features/grid/layer';
import {
  createCellHighlightLayer,
  type CellHighlightLayerOpts,
} from 'features/grid/cellHighlight';
import {
  createSelectionOverlayLayer,
  type SelectionOverlayLayerOpts,
} from 'features/selection/overlay';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import type { PoseProjection } from 'interactions/actions/resize/geometry';
import type { DebugConfig, DebugSink, DebugSnapshot } from '../debug/types';
import { parseDebugFlags } from '../debug/parseDebugFlags';
import { createDebugSink } from '../debug/createDebugSink';
import { createDebugOverlayLayer } from '../debug/createDebugOverlayLayer';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/select';

const alwaysVisible = (_id: string): boolean => true;
/** Returned by `helpersForLayers.subscribeGestures` when no gesture source is
 *  wired — the subscription is real, it just can never fire. */
const noOpUnsubscribe = (): void => {};
import { buildSceneTree, type HierarchicalAdapter } from './buildSceneTree';

/**
 * The scene-tree reading methods Canvas feature-detects at draw time, as an
 * *optional* mixin. A `SceneCanvasAdapter` supplies them; flat / bare-Canvas
 * adapters don't. `getPose` already lives on the base move adapter, so only the
 * three tree-walk methods are added here.
 */
type OptionalSceneHierarchy<TNode, TPose> = Partial<
  Pick<HierarchicalAdapter<TNode, TPose>, 'getLayers' | 'getNode' | 'getChildren'>
>;

/** The full adapter shape Canvas threads through layers + gesture hooks: the
 *  move/resize/rotate intersection plus the optional scene-tree methods. */
type CanvasAdapter<TNode extends { id: string }, TPose> = MoveAdapter<TNode, TPose> &
  ResizeAdapter<TNode, TPose> &
  RotateAdapter<TNode, TPose> &
  OptionalSceneHierarchy<TNode, TPose>;
import { wrapNodeOutput } from './wrapNodeOutput';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { usePinchZoomTool } from 'tools/builtin/pinchZoom';
import type { ViewportConfig } from './SceneCanvas/viewportConfig';
import { CursorCoordsHud } from './CursorCoordsHud';
import { PickHud } from './PickHud';
import { ModalityHud } from './ModalityHud';



/** Grid slot config — extends raw grid layer opts with an optional nested
 *  `highlight` sub-config. The cell-highlight layer is rendered immediately
 *  after the grid in the canonical stack. */
export type GridSlotConfig = GridLayerOpts & {
  /** Cell-highlight overlay; omit or set to `null` to skip. */
  highlight?: CellHighlightLayerOpts | null;
};

/** Scene slot config — describes how to draw one object with its effective pose. */
export interface SceneSlotConfig<TNode extends { id: string }, TPose> {
  /** Override `adapter.getNodes()` for the object iteration. */
  objects?: TNode[];
  /** Project an object to its committed pose. Defaults to `adapter.getPose(obj.id)`. */
  toPose?: (obj: TNode) => TPose;
  /** Draw a single object as a `DrawCommand` tree. */
  drawOne: (obj: TNode, pose: TPose, view: View) => DrawCommand[];
  /** Default ghost alpha for the move-overlay slot. Default 0.85. */
  ghostAlpha?: number;
  /**
   * Optional per-id alpha multiplier. When supplied, each node's emitted
   * `DrawCommand[]` is wrapped in a `{ kind: 'group', alpha }` when the
   * returned value is not 1. The scoping-dim integration supplies this to
   * dim non-active nodes during a mode transition.
   *
   * Defaults to `() => 1` (no effect).
   */
  alphaFor?: (id: string) => number;
  /**
   * Optional post-processor for the scene slot's emitted commands. Called
   * with the final world-space `DrawCommand[]` each time a scene canvas
   * layer draws (after per-node rotation wrapping and `alphaFor`); the
   * return value replaces the array handed to the renderer. When the scene
   * slot is split into per-scene-layer canvas layers (`scene:<layerId>`),
   * it runs once per layer. Identity by default.
   *
   * Commands are world-space — `drawLayers` applies the view transform
   * afterward, so e.g. a `clip` path in a wrapping group is authored in
   * world coordinates. Note clip nesting is capped at 7 levels; a wrapping
   * group with `clip` consumes one.
   *
   * The move-overlay ghost (drag preview) is not post-processed.
   */
  postProcess?: (cmds: DrawCommand[], view: View, dims: Dims) => DrawCommand[];
}

/** Selection-overlay slot config — passed through to `createSelectionOverlayLayer`,
 *  minus the `getSelection`/`getPose` Canvas wires automatically. */
export type SelectionOverlaySlotConfig<TPose> = Omit<
  SelectionOverlayLayerOpts<TPose>,
  'getSelection' | 'getPose'
> & {
  /** Override the auto-wired pose lookup (overlay-aware → adapter fallback). */
  poseById?: (id: string) => TPose | null;
};


/** Per-slot config union. The key narrows it in practice. */
export type StandardSlotConfig<TNode extends { id: string }, TPose> =
  | GridSlotConfig
  | SceneSlotConfig<TNode, TPose>
  | SelectionOverlaySlotConfig<TPose>;

/** What may fill one of the canvas's named layer slots: a config the canvas
 *  builds the layer from, a pre-built layer, or `null` to leave the slot
 *  empty. */
export type LayerSlotValue<TNode extends { id: string }, TPose> =
  | StandardSlotConfig<TNode, TPose>
  | CustomLayerEntry
  | null;

/** The canvas's render stack, as named slots. The standard slots (grid,
 *  scene, selection overlay, cell highlight) can be configured, replaced with
 *  a layer of your own, or switched off; further keys add custom layers. */
export type LayersMap<TNode extends { id: string }, TPose> = {
  grid?: GridSlotConfig | null;
  scene?: SceneSlotConfig<TNode, TPose> | null;
  /** Selection-overlay slot. Canvas constructs the layer from a
   *  `SelectionOverlaySlotConfig`; pass a `CustomLayerEntry` (`{ layer }`) to
   *  supply a pre-built layer (e.g. from `<SceneCanvas>`). */
  selectionOverlay?: SelectionOverlaySlotConfig<TPose> | CustomLayerEntry | null;
  /** Cell-highlight overlay slot. Canvas falls back to `grid.highlight` when
   *  this slot is absent. Pass a `CustomLayerEntry` (`{ layer }`) to supply a
   *  pre-built layer directly, or `null` to suppress even when `grid.highlight`
   *  is set. */
  cellHighlight?: CustomLayerEntry | null;
} & {
  [customKey: string]: LayerSlotValue<TNode, TPose> | undefined;
};

/**
 * High-level selection semantics. Kept as a public type for `<SceneCanvas>`
 * consumers — Canvas itself no longer accepts a `selectionMode` prop.
 *
 *   - `'single'` (default) — click replaces the selection with one id.
 *   - `'multi'` — shift-click extends/toggles. Multi-selected objects draw a
 *     union AABB with corner handles.
 *   - `'none'` — canvas interactions never update selection state.
 */
export type CanvasSelectionMode = 'single' | 'multi' | 'none';

/**
 * Props for `<Canvas>` — the low-level WebGL surface + viewport +
 * pointer routing primitive.
 *
 * Canvas is scene-agnostic. It owns the GL surface, view state, pointer/
 * keyboard dispatch, and slot composition. It does NOT own selection state,
 * picking logic, kind registries, or scene-aware overlays — those belong in
 * `<SceneCanvas>`.
 */
export interface CanvasProps<TNode extends { id: string } = { id: string }, TPose = unknown> {
  /** CSS-pixel width. */
  width: number;
  /** CSS-pixel height. */
  height: number;

  /** Drawing-buffer density (device pixels per CSS pixel). When omitted the
   *  canvas reads `window.devicePixelRatio` per paint — the long-standing
   *  screen behavior. Supplying it makes density an explicit parameter, the
   *  same contract the headless `renderSceneToPixels` path follows (that
   *  path never reads ambient density at all). */
  dpr?: number;

  /**
   * Combined adapter for scene-slot rendering, bounds computation, and
   * move/resize/rotate gesture math. Optional — bare-Canvas consumers that
   * don't need a scene slot may omit it.
   *
   * Canvas threads this adapter into layer factories and gesture hooks. The
   * type is the move/resize/rotate intersection plus the *optional* scene-tree
   * methods (`getLayers`/`getNode`/`getChildren`) — present on a hierarchical
   * `SceneCanvasAdapter`, absent on flat adapters. The `buildSceneLayer` path
   * feature-detects them at draw time.
   *
   * `<SceneCanvas>` synthesizes this from a `Scene`; bare-`<Canvas>` consumers
   * must supply it explicitly when using the scene or selection-overlay slots.
   */
  adapter?: CanvasAdapter<TNode, TPose>;

  /** Layer map. See module docstring for slot semantics. */
  layers: LayersMap<TNode, TPose>;

  /**
   * Current selection state. Canvas is a pure pass-through — it owns no
   * selection state of its own. When absent, Canvas behaves as if nothing is
   * selected: no selection chrome, no select-on-click, no clear-on-background.
   *
   * `<SceneCanvas>` always supplies this from its internal `useSelection`.
   * Bare-`<Canvas>` consumers may omit it for non-selection use cases (e.g.
   * force-graph renderers or read-only viewers).
   */
  selection?: SelectionApi;


  /**
   * Pose↔bounds projection for non-rect `TPose` types. When supplied, drives
   * the default `boundsOf` fallback and the selection-overlay bounds source so
   * non-rect poses (e.g. `Path`) don't require per-prop overrides.
   * Defaults to the rect identity (`AUTO_POSE_DESCRIPTOR`).
   *
   * This is a math helper, not a scene-shaped concern — it converts a pose
   * value to an AABB and extracts rotation for the selection chrome. Bare-
   * Canvas consumers that use a non-rect pose type should supply this.
   */
  geometry?: PoseProjection<TPose>;

  // --- Gesture overrides (escape hatches for non-rect / group-aware apps) ---
  /**
   * Used by `PickHud` to display the list of ids under the cursor.
   * NOT used for tool routing — see `getNodeAtPoint` for that.
   * `<SceneCanvas>` passes its internal pick function here so the HUD
   * stays in sync with the scene's actual hit-test order.
   */
  pickEvery?: (worldX: number, worldY: number) => string | string[] | null;
  /**
   * Override for committed bounds lookup. When supplied, takes precedence over
   * the `geometry`-derived fallback. Used by the selection overlay, the
   * multi-select union AABB, and `helpersRef.getEffectiveBounds`. Optional —
   * bare-Canvas consumers that use a custom bounds shape should supply this;
   * `<SceneCanvas>` derives it from its scene adapter and passes it via the
   * scene-slot layer config rather than this prop.
   */
  boundsOf?: (id: string) => Bounds | null;
  /**
   * Custom pointer-to-world coordinate transform. When supplied, overrides the
   * default `(clientX - canvasRect.left) / scale + pan` calculation. Useful
   * for consumers that apply an additional CSS transform to the canvas element.
   */
  clientToWorld?: (canvas: HTMLCanvasElement, cx: number, cy: number) => [number, number];

  // --- Visuals / DOM passthrough ---
  className?: string;
  style?: React.CSSProperties;
  tabIndex?: number;
  /**
   * When `true` (default), the canvas element receives focus on `pointerdown`
   * so keyboard events (tool hotkeys, undo/redo) are captured without a
   * separate click-to-focus step. Set to `false` for canvases embedded inside
   * a larger focus-managed layout where auto-focus would steal focus from
   * sibling inputs.
   */
  autoFocusOnPointerDown?: boolean;

  /** Opt-in keyboard-driven actions wired against the canvas's effective
   *  selection. Each key turns the action on; values may be `true` (defaults)
   *  or a config dict. Omitting a key leaves the action unbound. */
  /** Tool primitive substrate. Pointer/keyboard/wheel events are routed
   *  through `tools.dispatcher`. */
  tools?: import('../tools/useTools').ToolsApi;

  /** Controlled viewport. When supplied, Canvas does not own the value —
   *  the consumer must supply `onViewChange` and re-render with the new
   *  view. See `View` JSDoc for the camera-position convention. */
  view?: View;
  /** Initial viewport for the uncontrolled path. Default `{x:0, y:0}`. */
  defaultView?: View;
  /** Fires whenever the viewport changes — in both controlled and
   *  uncontrolled modes. */
  onViewChange?: (next: View) => void;
  /**
   * Optional world-space rect that constrains pan. When supplied, every
   * `setView` call passes through `clampView(next, viewBounds, {width, height})`
   * before commit, keeping the visible rect inside `viewBounds`. If the visible
   * rect is larger than the bounds along an axis (zoomed out past extent), that
   * axis is centered. Has no effect on `scale` — wire `useZoom` bounds for that.
   *
   * A viewport concern, not scene-shaped. Consumers that want the pan to stay
   * inside a document page boundary should wire this with the page dimensions.
   */
  viewBounds?: { x: number; y: number; width: number; height: number };
  /**
   * Mutable ref Canvas writes overlay-aware pose/bounds lookups to on every
   * render. Custom layers can read it from inside their `draw` closure to
   * reflect in-flight gestures (move/resize/rotate) instead of the committed
   * scene. Both lookups apply when an id is in the active overlay; otherwise
   * they fall back to the adapter.
   *
   * Useful for custom layers that render scene content outside of the standard
   * slot system and need to stay in sync with gesture previews.
   */
  helpersRef?: React.MutableRefObject<CanvasHelpers<TPose> | null>;

  /**
   * Debug overlay configuration.
   *  - `undefined` (default): read `?debug=…` from the URL.
   *  - `false`: force off, ignore URL.
   *  - `DebugConfig` object: force on with that config, ignore URL.
   *
   * When enabled, the Canvas appends a screen-space `debug-overlay` layer
   * at the top of the layer stack and threads a `DebugSink` into every
   * interaction hook so they record hit math + handle positions.
   */
  debug?: DebugConfig | false;

  /** Test-only escape hatch: writes the live debug sink to this ref so tests
   *  can call `snapshot()` after a render. No effect when debug is off. */
  debugSinkRef?: React.MutableRefObject<(DebugSink & { snapshot(): DebugSnapshot }) | null>;

  /**
   * Custom shader programs to compile on the renderer. Each handle must come
   * from a module-level `registerProgram()` call. Compiled once per handle id
   * on first render (or on context restore). Pass a stable reference (e.g.
   * defined at module scope) — the array is read at renderer init time.
   */
  shaders?: ShaderProgramHandle[];

  /**
   * Extra source of ids whose committed paint should be suppressed during the
   * current frame (in addition to those reported by the tools' `previewIds()`).
   *
   * Wired by `<SceneCanvas>` to expose the new gesture-dispatcher's in-flight
   * handles: as legacy hooks are removed from tools, the
   * source-hide for move/clone/etc. needs to follow the preview-ghost layer
   * onto the dispatcher's `OngoingHandle.previewIds()`. Optional — bare
   * `<Canvas>` consumers don't need to wire it.
   */
  previewIdsExtra?: () => Iterable<string> | null;

  /**
   * Extra preview-pose lookup checked after the active tool's `previewPose`
   * misses. Wired by `<SceneCanvas>` to expose the gesture-dispatcher's
   * in-flight `OngoingHandle.previewPose(id)` so selection chrome (resize/
   * rotation handles, AABB outline) tracks the ghost during dispatcher-driven
   * drags. Returns `null` / `undefined` when no preview is in flight.
   */
  previewPoseExtra?: (id: string) => unknown;

  /**
   * In-flight gesture state `<Canvas>` can't see for itself. Backs the
   * `getGestureBounds` / `subscribeGestures` / `getGestureVersion` trio on
   * `helpersRef`; wired by `<SceneCanvas>` from the gesture dispatcher
   * (`createGestureSource`). Leaving it unwired is fine — those three then
   * report "no gesture in flight" and never fire.
   */
  gestureSource?: GestureSource;

  /**
   * Pinch-zoom DOM listener attachment for the canvas surface. When supplied,
   * `<Canvas>` calls `usePinchZoomTool` with `canvasRef` so two-finger pinch
   * events are handled directly on the canvas element.
   *
   * Hand tool registration, wheel pan/zoom action descriptors, and keyboard
   * zoom shortcuts are SceneCanvas-level concerns and are NOT owned by Canvas.
   * Those belong with the tool registry and gesture dispatcher that live in
   * SceneCanvas.
   *
   * When omitted, no pinch-zoom listener is attached.
   */
  viewport?: ViewportConfig;

  /**
   * FillStyle applied to the full canvas surface behind the scene. Accepts the
   * kit's `FillStyle` union (solid / pattern / linear-gradient / radial-gradient /
   * conic-gradient) so consumers don't have to author a background node just to
   * colorize the canvas.
   *
   * Rendered as a screen-space layer slotted before `'scene'` — independent of
   * pan / zoom. Canvas owns this layer; `<SceneCanvas>` forwards its own
   * `backgroundFill` prop verbatim so consumer apps see no breaking change.
   */
  backgroundFill?: FillStyle;

  /**
   * Dev HUD: when true, mounts a fixed-position widget showing live cursor
   * coords in both viewport (client) and canvas (world) frames. Useful for
   * diagnosing pointer-coord drift / pan-zoom misalignment without
   * instrumenting events.
   */
  cursorCoordsHud?: boolean;

  /**
   * Dev HUD: when true, mounts a fixed-position widget just below the
   * cursor-coords HUD listing the ids returned by `pickEvery(world)` under
   * the cursor. Useful for diagnosing hit-test order and container/leaf
   * overlap during select-tool work.
   */
  pickHud?: boolean;

  /**
   * Dev HUD: mounts a fixed-position widget below the pick HUD reporting
   * the active modality mode, the active-slot tool, and the hotkey stack.
   * Pass `true` to enable with no mode (renders `—` for the mode line —
   * useful until the modality machine is wired). Pass an object to supply
   * the current mode id.
   */
  modalityHud?: boolean | { modeId?: string };

  /**
   * Optional single-best hit resolver for the `pickHud` — the id this point
   * would select on a bare click. When omitted the HUD skips the bold-best
   * highlight. `<SceneCanvas>` forwards its `internalPickBest` here so the
   * HUD shows the same best-candidate SceneCanvas would pick.
   */
  pickBest?: (worldX: number, worldY: number) => string | null;


  /**
   * Optional mode-owned decoration layer. When supplied, Canvas inserts it
   * between the scene-render slot and the tool-overlay slot so decoration
   * draw commands (e.g. path-edit anchor dots) paint above scene content but
   * below tool overlays (drag rects, etc.).
   *
   * Slot ordering: scene → (scoping mask) → **decoration** → tool overlay → chrome.
   *
   * Wired by the modality machine after it activates a mode whose
   * `ModeDefinition` supplies a `paint()` factory. Omitting this prop is a
   * no-op — existing consumers are unaffected.
   */
  decorationLayer?: RenderLayer<unknown>;

  /**
   * Chrome-caps visibility resolver. When supplied, Canvas:
   *   - exposes the predicate on `helpersForLayers.getIsVisible` so
   *     custom layers (notably `composeAffordanceLayer`) can gate
   *     paint by chrome id;
   *   - threads it into the affordance-pipeline `HitTestContext.isVisible`
   *     so the same gate applies to hit-testing.
   *
   * Called fresh per draw / per hitTest, so the consumer can return a
   * predicate that closes over per-frame `ChromeCtx`. Omit to leave
   * every chrome element visible (pre-chrome-caps behavior).
   */
  getIsVisible?: () => (id: string) => boolean;
}

/** Live overlay-aware lookups exposed to custom layers via `helpersRef`. */
export interface CanvasHelpers<TPose> {
  /** Pose currently displayed for `id` — drag/resize/rotate overlay if active,
   *  otherwise the committed pose from the adapter. Returns `null` if the id
   *  isn't known. */
  getEffectivePose(id: string): TPose | null;
  /** Overlay-aware bounds for `id`. */
  getEffectiveBounds(id: string): Bounds | null;
  /**
   * World-space AABB of everything the in-flight gesture proposes — the
   * displaced poses of nodes being moved / resized / rotated / cloned, plus
   * any nascent insert that has no scene node yet. `null` when no gesture is
   * in flight.
   *
   * This reports the *gesture*, not the document: committed content the
   * gesture isn't touching is excluded, so a consumer that wants the union
   * with the rest of the scene still walks its own ids through
   * `getEffectiveBounds`. It exists because every other lookup here is keyed
   * by node id, which can't answer "where is the shape the user is drawing
   * right now" — a drag-to-insert has no id until pointer-up.
   *
   * Select-only gestures are deliberately excluded: a marquee or lasso has
   * geometry but proposes no content, and a consumer sizing itself to the
   * gesture must not grow because the user swept a selection rectangle.
   *
   * The result is a plain AABB — never rotated. Rotated parts are folded in
   * by their rotated extent (a union of several oriented boxes has no single
   * orientation to report).
   */
  getGestureBounds(): Bounds | null;
  /**
   * Subscribe to the gesture layer's change signal — the other half of the
   * `useSyncExternalStore` contract for everything on this object that moves
   * during a drag (`getEffectivePose`, `getEffectiveBounds`,
   * `getGestureBounds`). Returns an unsubscribe.
   *
   * Fires once per dispatcher pump: gesture start, every pointermove that
   * reaches an in-flight handle, end, and cancel — plus UI-driven ongoing
   * actions (a slider bound to an ongoing action pumps the same way). It
   * fires on the pump, not on a diff: a pump that changed nothing observable
   * still notifies, so don't hang expensive work directly off the callback.
   *
   * It does **not** cover committed scene edits (subscribe to the scene for
   * those) or previews a consumer's own tool publishes from React state
   * (that tool re-renders on its own).
   *
   * Without a gesture source wired — a bare `<Canvas>` — this is a no-op
   * subscription that never fires.
   */
  subscribeGestures(fn: () => void): () => void;
  /**
   * Monotonic counter bumped on exactly the events `subscribeGestures` fires
   * on. Pair the two for `useSyncExternalStore`:
   *
   * ```ts
   * const gestureVersion = useSyncExternalStore(
   *   useCallback((cb) => helpersRef.current?.subscribeGestures(cb) ?? (() => {}), []),
   *   () => helpersRef.current?.getGestureVersion() ?? 0,
   * );
   * ```
   *
   * Starts at 0 and only increases. `0` is also what a bare `<Canvas>` with
   * no gesture source reports, forever.
   */
  getGestureVersion(): number;
  /** Returns the live ChromeState built once per render. Affordances and
   *  custom layers that need overlay-aware selection state (selection ids,
   *  bounds, multi-union AABB, modifier flags) read from this. */
  getChromeState(): ChromeState;
  /** Active debug sink, when `<Canvas debug=...>` is enabled. Layers that
   *  want to participate in `hitboxes`/`bounds`/etc. visualization can
   *  call into this from their `draw` callback. Returns `null` when
   *  debug is off — no-op for production renders. */
  getDebug(): DebugSink | null;
  /** Chrome-caps visibility predicate, keyed by chrome id. Returns a
   *  function that affordance/overlay layers can call per-element to
   *  decide whether to draw / hit-test. When the parent didn't supply
   *  a resolver, this returns the universal `() => true`. */
  getIsVisible(): (id: string) => boolean;
}

// Walks every registered + ambient tool: resize/rotate will register as
function registerShadersOnRenderer(
  renderer: WeaselRenderer,
  shaders: ShaderProgramHandle[] | undefined,
): void {
  if (!shaders) return;
  for (const handle of shaders) {
    try {
      renderer.registerProgram(handle);
    } catch (e) {
      console.warn(`Canvas: failed to register shader "${handle.id}":`, e);
    }
  }
}

/**
 * Build the scene layer. Tool ghosts (in-flight drag/resize/rotate poses) are
 * published via the active tool's `previewPose`/`previewIds` and rendered on
 * top of this layer (see SceneCanvas's preview-ghost layer); we draw committed
 * poses here, and `hideIds()` lets us skip the committed paint of ids the
 * active tool is currently ghosting so the source doesn't show through.
 */
export function buildSceneLayer<TNode extends { id: string }, TPose>(
  cfg: SceneSlotConfig<TNode, TPose>,
  adapter: CanvasAdapter<TNode, TPose> | undefined,
  debugSink: DebugSink | null,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
  hideIds: () => Set<string> | null,
  /** When set, the returned layer carries this `id` and paints ONLY the named
   *  scene layer (the rest are walked for ancestor clips). Used to split the
   *  scene slot into per-scene-layer, individually-orderable canvas layers
   *  (`scene:<layerId>`) so consumers can interleave custom layers between
   *  them. Omit for the single bundled `scene` layer. */
  slot?: { id: string; forLayer: string },
): RenderLayer<unknown> {
  const toPose =
    cfg.toPose ??
    ((obj: TNode) => (adapter ? adapter.getPose(obj.id) : (obj as unknown as TPose)));
  const drawOne = cfg.drawOne;
  const postProcess = cfg.postProcess;
  return {
    id: slot?.id ?? 'scene',
    label: slot ? `Scene: ${slot.forLayer}` : 'Scene',
    draw: (_data, view, dims) => {
      const hidden = hideIds();
      const a = adapter;
      if (
        a &&
        cfg.objects === undefined &&
        typeof a.getLayers === 'function' &&
        typeof a.getNode === 'function' &&
        typeof a.getChildren === 'function' &&
        drawOne
      ) {
        const filteredDrawOne = (obj: TNode, pose: TPose, v: View): DrawCommand[] => {
          if (hidden && hidden.has(obj.id)) return [];
          const cmds = drawOne(obj, pose, v);
          if (debugSink) {
            const b = boundsOfFn ? boundsOfFn(obj.id) : null;
            if (b) debugSink.recordBounds(obj.id, b);
            const ox = (pose as { x?: number }).x ?? (b ? b.x : 0);
            const oy = (pose as { y?: number }).y ?? (b ? b.y : 0);
            debugSink.recordOrigin(obj.id, { x: ox, y: oy });
          }
          return wrapNodeOutput(cmds, pose, cfg.alphaFor ? cfg.alphaFor(obj.id) : 1);
        };
        // Honor cfg.toPose on the hierarchical path by shimming getPose on the
        // adapter so buildSceneTree routes through it instead of the raw adapter.
        const hierarchicalAdapter = cfg.toPose
          ? {
              ...a,
              getPose: (id: string) => {
                const obj = a.getNode!(id);
                return obj ? toPose(obj) : a.getPose(id);
              },
            }
          : a;
        // World-space commands; drawLayers wraps in viewToMat3 automatically.
        const tree = buildSceneTree(
          hierarchicalAdapter as Parameters<typeof buildSceneTree>[0],
          filteredDrawOne as unknown as Parameters<typeof buildSceneTree>[1],
          view,
          slot?.forLayer,
        );
        return postProcess ? postProcess(tree, view, dims) : tree;
      }
      // Flat fallback — keep existing body verbatim. (Per-layer slotting only
      // applies on the hierarchical path; a flat adapter has no scene layers,
      // so the `scene:<layer>` split is a no-op and we emit the whole scene.)
      const objects = cfg.objects ?? adapter?.getNodes() ?? [];
      const children: DrawCommand[] = [];
      for (const obj of objects) {
        if (hidden && hidden.has(obj.id)) continue;
        const pose: TPose = toPose(obj);
        if (drawOne) {
          const cmds = drawOne(obj, pose, view);
          const wrapped = wrapNodeOutput(cmds, pose, cfg.alphaFor ? cfg.alphaFor(obj.id) : 1);
          for (const cmd of wrapped) children.push(cmd);
        }
        if (debugSink) {
          const b = boundsOfFn ? boundsOfFn(obj.id) : null;
          if (b) debugSink.recordBounds(obj.id, { x: b.x, y: b.y, width: b.width, height: b.height });
          const ox = (pose as { x?: number }).x ?? (b ? b.x : 0);
          const oy = (pose as { y?: number }).y ?? (b ? b.y : 0);
          debugSink.recordOrigin(obj.id, { x: ox, y: oy });
        }
      }
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return postProcess ? postProcess(children, view, dims) : children;
    },
  };
}

/**
 * Build the scene slot as one canvas layer **per scene layer** — keyed
 * `scene:<layerId>` — when the adapter is hierarchical (exposes `getLayers`).
 * This lets consumers interleave custom layers *between* scene layers via the
 * standard slot anchoring (`before: 'scene:plantings'`). Each per-layer canvas
 * layer re-runs the scene walk for its own layer only (others are still walked
 * for ancestor clips). Falls back to a single `scene` layer for flat adapters
 * or adapters with no declared layers.
 */
export function buildSceneLayers<TNode extends { id: string }, TPose>(
  cfg: SceneSlotConfig<TNode, TPose>,
  adapter: CanvasAdapter<TNode, TPose> | undefined,
  debugSink: DebugSink | null,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
  hideIds: () => Set<string> | null,
): Array<{ key: string; layer: RenderLayer<unknown> }> {
  const sceneLayerIds =
    cfg.objects === undefined && typeof adapter?.getLayers === 'function'
      ? adapter.getLayers().map((l) => l.id)
      : null;
  if (!sceneLayerIds || sceneLayerIds.length === 0) {
    return [{ key: 'scene', layer: buildSceneLayer(cfg, adapter, debugSink, boundsOfFn, hideIds) }];
  }
  return sceneLayerIds.map((id) => ({
    key: `scene:${id}`,
    layer: buildSceneLayer(cfg, adapter, debugSink, boundsOfFn, hideIds, {
      id: `scene:${id}`,
      forLayer: id,
    }),
  }));
}

function resolveToolsCursor(
  tools: ToolsApi,
  ctxBase?: () => Omit<ToolCtx, 'scratch'>,
): string | undefined {
  const id = tools.hotkeyEngaged ?? tools.active;
  const tool = tools.registry[id];
  if (!tool?.cursor) return undefined;
  if (typeof tool.cursor === 'string') return tool.cursor;
  if (!ctxBase) return undefined;
  // Function form: invoke at render time with the live base ctx.
  //
  // `ctx.scratch` is always null here. It used to be the tool-routing
  // dispatcher's in-flight gesture scratch, which is how `grab` became
  // `grabbing` and how select swapped to `move` — mid-gesture cursors are now
  // `Action.activeCursor`, applied imperatively by the hover pump. A tool that
  // wants a cursor driven by its own state closes over its own ref (the pen
  // does, for its close-path hint).
  try {
    const base = ctxBase();
    return tool.cursor({ ...base, scratch: null });
  } catch {
    return undefined;
  }
}

/** Client coords to world, through the `clientToWorld` prop when one is
 *  supplied and the canvas rect otherwise. Every pointer path in this file
 *  goes through here so the two cannot drift. */
function toWorld(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  view: View,
  override: CanvasProps<never, never>['clientToWorld'],
): [number, number] {
  if (override) return override(canvas, clientX, clientY);
  return clientToWorldHelper(clientX, clientY, canvas.getBoundingClientRect(), view);
}

function CanvasInner<TNode extends { id: string }, TPose>(
  props: CanvasProps<TNode, TPose>,
  ref: React.ForwardedRef<CanvasExtensionApi>,
) {
  const {
    width,
    height,
    dpr: dprProp,
    adapter: adapterProp,
    layers: layersMap,
    selection,
    boundsOf,
    pickEvery,
    clientToWorld,
    geometry = AUTO_POSE_DESCRIPTOR as unknown as PoseProjection<TPose>,
    className,
    style,
    tabIndex = 0,
    autoFocusOnPointerDown = true,
    helpersRef,
    tools,
    view: viewProp,
    defaultView,
    onViewChange,
    viewBounds,
    debug: debugProp,
    debugSinkRef,
    shaders,
    previewIdsExtra,
    previewPoseExtra,
    gestureSource,
    viewport,
    backgroundFill,
    cursorCoordsHud,
    pickHud,
    modalityHud,
    pickBest,
    decorationLayer,
    getIsVisible,
  } = props;

  // Resolve debug config: explicit prop wins; `undefined` falls back to URL;
  // `false` forces off.
  const resolvedDebugConfig = useMemo<DebugConfig | null>(() => {
    if (debugProp === false) return null;
    if (debugProp !== undefined) return debugProp;
    if (typeof window === 'undefined') return null;
    return parseDebugFlags(window.location.search);
  }, [debugProp]);

  // Lazily build one sink per Canvas mount (per resolved config).
  const debugSink = useMemo<(DebugSink & { snapshot(): DebugSnapshot }) | null>(() => {
    if (resolvedDebugConfig === null) return null;
    return createDebugSink(resolvedDebugConfig);
  }, [resolvedDebugConfig]);
  if (debugSinkRef) debugSinkRef.current = debugSink;
  const debugSinkRefForCtx = useRef<DebugSink | null>(null);
  debugSinkRefForCtx.current = debugSink;

  const adapter = adapterProp;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Read by `hitTestExtras`, which is built once and must see live values.
  const helpersForLayersRef = useRef<CanvasHelpers<TPose> | null>(null);
  const dimsRef = useRef({ width, height });
  dimsRef.current = { width, height };
  const getIsVisibleRef = useRef(getIsVisible);
  getIsVisibleRef.current = getIsVisible;

  const [redrawNonce, setRedrawNonce] = useState(0);
  const requestRedraw = useCallback(() => setRedrawNonce(n => n + 1), []);

  const extrasRef = useRef<Set<RenderLayer<unknown>>>(new Set());
  const registerLayer = useCallback((layer: RenderLayer<unknown>) => {
    extrasRef.current.add(layer);
    setRedrawNonce(n => n + 1);
    return () => {
      extrasRef.current.delete(layer);
      setRedrawNonce(n => n + 1);
    };
  }, []);

  // Hit-test registered layers topmost-first. Registration order is draw
  // order, so the last-registered layer is on top and gets first refusal —
  // the reverse of the Set's iteration order.
  //
  // `<SceneCanvas>` folds this into its `affordanceAt` thunk. Canvas can't do
  // that itself: it has the layers but not the dispatcher.
  const hitTestExtras = useCallback((worldX: number, worldY: number) => {
    const layers = [...extrasRef.current].reverse();
    const view = viewRef.current;
    const dims = dimsRef.current;
    const isVisible = getIsVisibleRef.current?.() ?? alwaysVisible;
    for (const layer of layers) {
      if (!layer.hitTest) continue;
      const hit = layer.hitTest(worldX, worldY, helpersForLayersRef.current, view, dims, isVisible);
      if (hit) return { layerId: layer.id, hit };
    }
    return null;
  }, []);

  useImperativeHandle(ref, () => ({
    element: canvasRef.current,
    requestRedraw,
    registerLayer,
    hitTestExtras,
  }), [canvasRef, requestRedraw, registerLayer, hitTestExtras]);

  // GL renderer (lazy-instantiated on first paint).
  const glRendererRef = useRef<WeaselRenderer | null>(null);
  const lastResizeRef = useRef<{ w: number; h: number; dpr: number } | null>(null);

  // Viewport state: hybrid uncontrolled/controlled. When `viewProp` is
  // supplied we are controlled (consumer owns state). Otherwise we keep
  // internal state seeded from `defaultView`. `setView` always fires
  // `onViewChange` so consumers can persist regardless of mode.
  const [internalView, setInternalView] = useState<View>(defaultView ?? { x: 0, y: 0, scale: { x: 1, y: 1 } });
  const effectiveView: View = viewProp ?? internalView;
  const viewRef = useRef<View>(effectiveView);
  viewRef.current = effectiveView;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const viewBoundsRef = useRef(viewBounds);
  viewBoundsRef.current = viewBounds;
  const setView = useCallback((next: View) => {
    const bounds = viewBoundsRef.current;
    const clamped = bounds ? clampView(next, bounds, { width, height }) : next;
    if (viewProp === undefined) setInternalView(clamped);
    onViewChangeRef.current?.(clamped);
  }, [viewProp, width, height]);
  const setViewRef = useRef(setView);
  setViewRef.current = setView;

  // Pinch-zoom: Canvas owns the DOM listener because it needs canvasRef.
  // usePinchZoomTool is a no-op when viewport?.pinchZoom is falsy. Hand tool,
  // wheel pan/zoom, and keyboard zoom are SceneCanvas-level concerns (they
  // register into the tool registry / gesture dispatcher that lives there).
  const pinchConfig: { min?: number; max?: number } | null =
    viewport?.pinchZoom === true ? {} : (viewport?.pinchZoom || null);
  usePinchZoomTool(
    canvasRef,
    effectiveView,
    setView,
    { ...(pinchConfig ?? {}), enabled: pinchConfig !== null },
  );

  // Internal hooks always run (rules of hooks). They consult a noop adapter
  // when none is supplied; their controllers are then unused because the
  // gesture wiring below only enables move/resize when `adapter` is present.
  const noopAdapter = useMemo(
    () =>
      ({
        getPose: () => ({}) as TPose,
        getNodes: () => [],
      }) as unknown as MoveAdapter<TNode, TPose>
        & ResizeAdapter<TNode, TPose>
        & RotateAdapter<TNode, TPose>,
    [],
  );
  const effectiveAdapter = (adapter ?? noopAdapter) as MoveAdapter<TNode, TPose>
    & ResizeAdapter<TNode, TPose>
    & RotateAdapter<TNode, TPose>;

  // Canvas owns no selection state. The `selection` prop is the sole source.
  // When absent, behave as if no selection exists (no chrome, no overlay).
  // A no-op fallback keeps all downstream reads safe without branching.
  const noopSelection = useMemo<SelectionApi>(
    () => ({
      current: [],
      get: () => [],
      contains: () => false,
      set: () => {},
      add: () => {},
      remove: () => {},
      toggle: () => {},
      clear: () => {},
      applyClick: () => {},
      adapterMethods: {
        getSelection: () => [],
        setSelection: () => {},
      },
    }),
    [],
  );
  const effectiveSelection: SelectionApi = selection ?? noopSelection;

  // Base ctx for the function form of `Tool.cursor` — the last consumer of
  // `ToolCtx` now that the tool-routing dispatcher is gone. Refs so identity
  // stays stable while the underlying values update.
  const effectiveSelectionRefForCtx = useRef(effectiveSelection);
  effectiveSelectionRefForCtx.current = effectiveSelection;
  const effectiveAdapterRefForCtx = useRef(effectiveAdapter);
  effectiveAdapterRefForCtx.current = effectiveAdapter;

  const clientToWorldRef = useRef(clientToWorld);
  clientToWorldRef.current = clientToWorld;
  const toolsCtxBase = useMemo(
    () => (overrides?: {
      clientX?: number;
      clientY?: number;
      modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean };
    }) => {
      const view = viewRef.current;
      let worldX = 0;
      let worldY = 0;
      const c = canvasRef.current;
      if (overrides && (overrides.clientX !== undefined || overrides.clientY !== undefined) && c) {
        const cx = overrides.clientX ?? 0;
        const cy = overrides.clientY ?? 0;
        [worldX, worldY] = toWorld(c, cx, cy, view, clientToWorldRef.current);
      }
      const rect = c ? c.getBoundingClientRect() : (typeof DOMRect !== 'undefined' ? new DOMRect() : ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 } as DOMRect));
      const m = overrides?.modifiers;
      return {
        worldX,
        worldY,
        modifiers: m
          ? { alt: m.alt, shift: m.shift, meta: m.meta, ctrl: m.ctrl, space: false }
          : { alt: false, shift: false, meta: false, ctrl: false, space: false },
        selection: effectiveSelectionRefForCtx.current,
        adapter: effectiveAdapterRefForCtx.current,
        applyOps: (ops: Op[], label: string) => {
          dispatchApplyBatch(effectiveAdapterRefForCtx.current, ops, label);
        },
        view,
        setView: setViewRef.current,
        canvasRect: rect,
        debug: debugSinkRefForCtx.current ?? undefined,
      };
    },
    [],
  );

  // Stable wrappers for HUD props — read the ref at call time so the HUDs
  // don't reinstall their useEffect on every render when the prop identity
  // changes (e.g. when SceneCanvas re-renders with a new lambda reference).
  // pickEvery and pickBest are HUD-only.
  const pickEveryRef = useRef(pickEvery);
  pickEveryRef.current = pickEvery;
  const pickBestRef = useRef(pickBest);
  pickBestRef.current = pickBest;
  const stablePickEveryForHud = useCallback(
    (wx: number, wy: number): readonly string[] => {
      const pe = pickEveryRef.current;
      if (!pe) return [];
      const raw = pe(wx, wy);
      if (!raw) return [];
      return Array.isArray(raw) ? raw : [raw];
    },
    [],
  );
  const stablePickBestForHud = useCallback(
    (wx: number, wy: number): string | null => pickBestRef.current?.(wx, wy) ?? null,
    [],
  );
  // Selection-driven action gestures (delete/nudge/undoRedo/duplicate) used
  // to be wired here via legacy hooks. They now go through the Actions
  // Registry / dispatcher path; consumers register them via the kit's
  // standard descriptors (see `useStandardActions`).

  // Committed pose/bounds lookups. Live overlay state during a drag now
  // arrives via the active Tool's `previewPose`/`previewBounds`; helpersForLayers
  // composes that on top of these committed lookups below.
  const baseBoundsOf = useMemo(() => {
    if (boundsOf) return boundsOf;
    if (!adapter) return undefined;
    return (id: string): Bounds | null => {
      try {
        const pose = adapter.getPose(id);
        const b = geometry.getBounds(pose);
        const rot = geometry.getRotation?.(pose);
        return rot ? { ...b, rotation: rot } : b;
      } catch {
        return null;
      }
    };
  }, [boundsOf, adapter, geometry]);

  const committedPoseOf = (id: string): TPose | null => {
    if (!adapter) return null;
    try {
      return adapter.getPose(id);
    } catch {
      return null;
    }
  };

  const selectedIdsForWiring = effectiveSelection.current;
  // Canvas no longer owns selectionMode. Multi-selection is inferred from the
  // selection state itself: when more than one id is selected, activate the
  // union-AABB chrome path. SceneCanvas configures its tools for multi-mode
  // via selectionOptions; Canvas simply reflects what arrived in the prop.
  const multiActive = selectedIdsForWiring.length > 1;

  // Hold the latest dispatcher-side preview extras in a ref so chromeState's
  // closure reads live values without forcing the memo to rebuild every render.
  const previewExtraRef = useRef({ previewPoseExtra, previewIdsExtra });
  previewExtraRef.current = { previewPoseExtra, previewIdsExtra };

  // boundsOf: pass-through for real ids. The synthetic multi-selection id is
  // resolved by the active tool's `previewBounds` (see `useSelectTool`'s
  // `MULTI_RESIZE_TARGET_ID` branch) — Canvas no longer special-cases it
  // inline. For overlays that read bounds outside a tool gesture, the
  // selection-overlay path below routes through `previewToolBounds` which surfaces
  // the tool's union synthesis.
  const effectiveBoundsOf = useMemo(() => {
    return boundsOf ?? baseBoundsOf;
  }, [boundsOf, baseBoundsOf]);

  const chromeState: ChromeState = useMemo(
    () => buildChromeState({
      selection: selectedIdsForWiring,
      multiActive,
      // Prefer the active tool's previewBounds (live during a drag) so
      // resize/rotation handles track the dragged object. Falls back to
      // committed bounds when no gesture is in flight.
      effectiveBoundsOf: (id) => {
        if (tools) {
          const b = firstPreviewBounds(tools, id);
          if (b) return b;
          const p = firstPreviewPose(tools, id);
          if (p != null) return geometry.getBounds(p as TPose);
        }
        const extras = previewExtraRef.current;
        if (extras.previewPoseExtra) {
          const p = extras.previewPoseExtra(id);
          if (p != null) return geometry.getBounds(p as TPose);
        }
        return effectiveBoundsOf ? effectiveBoundsOf(id) : null;
      },
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      // Rotation-capability predicate. Reads the committed pose (gestures
      // don't change descriptor capability) and asks the geometry. Absent
      // adapter / unknown ids fall back to `true` so the affordance stays
      // visible — preserves pre-existing behavior for consumers that wire
      // bounds without an adapter.
      canRotate: (id) => {
        if (!geometry.supportsRotation) return true;
        const pose = committedPoseOf(id);
        if (pose == null) return true;
        return geometry.supportsRotation(pose);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIdsForWiring, multiActive, effectiveBoundsOf, tools, geometry, adapter],
  );

  // The affordance-layer hit-test used to be wired into the tool-routing
  // dispatcher from here, so its pointerdown could walk tool overlays
  // top-down. `<SceneCanvas>` now composes the equivalent walk into the
  // `affordanceAt` thunk it hands `useGestureDispatcher` — over registered
  // layers via `hitTestExtras` above, and over selection chrome itself.

  // helpersForLayers: overlay-aware lookups passed to every RenderLayer.draw
  // call (as the `data` arg) so custom layers can read live overlay state
  // directly from their draw closure. The legacy `helpersRef` prop still
  // mirrors the same value for back-compat. The active Tool's `previewPose`/
  // `previewBounds` is the only overlay source post-cleanup; falls through to
  // the committed adapter pose / bounds when no tool is mid-gesture.
  const previewToolPose = useCallback((id: string): TPose | null => {
    if (tools) {
      const p = firstPreviewPose(tools, id);
      if (p != null) return p as TPose;
    }
    const extra = previewExtraRef.current.previewPoseExtra;
    if (extra) {
      const p = extra(id);
      if (p != null) return p as TPose;
    }
    return null;
  }, [tools]);
  const previewToolBounds = useCallback((id: string): Bounds | null => {
    if (tools) {
      const b = firstPreviewBounds(tools, id);
      if (b) return b;
      const p = firstPreviewPose(tools, id);
      if (p != null) return geometry.getBounds(p as TPose);
    }
    const extra = previewExtraRef.current.previewPoseExtra;
    if (extra) {
      const p = extra(id);
      if (p != null) return geometry.getBounds(p as TPose);
    }
    return null;
  }, [tools, geometry]);

  const helpersForLayers: CanvasHelpers<TPose> = {
    getEffectivePose: (id: string): TPose | null => {
      const tp = previewToolPose(id);
      if (tp != null) return tp;
      return committedPoseOf(id);
    },
    getEffectiveBounds: (id: string): Bounds | null => {
      const tb = previewToolBounds(id);
      if (tb != null) return tb;
      if (effectiveBoundsOf) return effectiveBoundsOf(id);
      const p = committedPoseOf(id);
      return p == null ? null : geometry.getBounds(p);
    },
    getGestureBounds: (): Bounds | null => {
      // In-flight ids come from both preview sources the ghost layer walks:
      // tool-published `previewIds()` and the dispatcher's in-flight handles
      // (via `gestureSource.ids()`). Using the same sets keeps this from
      // disagreeing with what the user sees ghosted.
      const ids = aggregatePreviewIds(tools);
      const extraIds = gestureSource?.ids();
      if (extraIds) for (const id of extraIds) ids.add(id);

      const parts: (Bounds | null)[] = [];
      for (const id of ids) parts.push(previewToolBounds(id));
      // Nascent inserts have no id to look up — they arrive as ready-made
      // world AABBs.
      const extraBounds = gestureSource?.bounds();
      if (extraBounds) for (const b of extraBounds) parts.push(b);
      return unionGestureBounds(parts);
    },
    subscribeGestures: (fn: () => void): (() => void) =>
      gestureSource?.subscribe(fn) ?? noOpUnsubscribe,
    getGestureVersion: (): number => gestureSource?.getVersion() ?? 0,
    getChromeState: () => chromeState,
    getDebug: () => debugSink,
    getIsVisible: () => getIsVisibleRef.current?.() ?? alwaysVisible,
  };
  helpersForLayersRef.current = helpersForLayers;
  if (helpersRef) helpersRef.current = helpersForLayers;

  // Pointer-pressed flag. The only thing `<Canvas>` still needs to know about
  // pointer state: `onUncapturedMove` means "hover", so it stands down while a
  // button is held. Everything else about pointer input — thresholds, click and
  // double-click synthesis, drag handles, the document-level backstop for a
  // release that lands off-canvas — belongs to `useGestureDispatcher`, which
  // attaches its own listeners to this same element.
  const pointerDownRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (autoFocusOnPointerDown) e.currentTarget.focus();
    pointerDownRef.current = true;
  };
  const handlePointerMove =
    ((e: React.PointerEvent<HTMLCanvasElement>) => {
      // Dispatch onUncapturedMove to layers when no button is held.
      if (pointerDownRef.current) return;
      const c = e.currentTarget;
      const view = viewRef.current;
      const [worldX, worldY] = toWorld(c, e.clientX, e.clientY, view, clientToWorldRef.current);
      for (const layer of layersWithDebug) {
        layer.onUncapturedMove?.(worldX, worldY, e.nativeEvent, view, { width, height });
      }
    });
  const handlePointerLeave = (_e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerDownRef.current = false;
    for (const layer of layersWithDebug) layer.onUncapturedLeave?.();
  };
  const handlePointerUp = (_e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerDownRef.current = false;
  };
  const handlePointerCancel = undefined;

  const selectedIds = effectiveSelection.current;

  // Background-fill layer: screen-space, emits a single full-canvas rect with
  // the configured FillStyle. Slotted before 'scene' so the scene draws on top.
  // Independent of pan / zoom — backgrounds are canvas chrome, not world content.
  const backgroundLayer = useMemo<RenderLayer<unknown> | null>(() => {
    if (!backgroundFill) return null;
    return {
      id: 'scene-background-fill',
      label: 'Background fill',
      space: 'screen',
      draw: (_data, _view, dims) => [{
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: dims.width, height: dims.height },
        fill: backgroundFill,
      }],
    };
  }, [backgroundFill]);

  const layers = useMemo<RenderLayer<unknown>[]>(() => {
    const standardLayers: Partial<
      Record<(typeof STANDARD_SLOTS)[number], RenderLayer<unknown>>
    > = {};

    const grid = layersMap.grid;
    if (grid && !isCustomEntry(grid)) {
      const gridCfg = grid as GridSlotConfig;
      const { highlight, ...gridOpts } = gridCfg;
      standardLayers.grid = createGridLayer(gridOpts as GridLayerOpts);
      if (highlight) {
        standardLayers.cellHighlight = createCellHighlightLayer(highlight);
      }
    }

    // Top-level `cellHighlight` slot: a pre-built CustomLayerEntry wins over
    // the `grid.highlight` sub-config constructed above. Explicit `null`
    // suppresses the slot (even when grid.highlight was set).
    const cellHighlightSlot = layersMap.cellHighlight;
    if (cellHighlightSlot !== undefined) {
      if (cellHighlightSlot === null) {
        standardLayers.cellHighlight = undefined;
      } else {
        // isCustomEntry check is redundant since the slot only accepts
        // CustomLayerEntry | null, but kept for runtime safety.
        standardLayers.cellHighlight = isCustomEntry(cellHighlightSlot)
          ? cellHighlightSlot.layer
          : undefined;
      }
    }

    const sceneCfg = layersMap.scene as SceneSlotConfig<TNode, TPose> | null | undefined;
    let sceneLayers: Array<{ key: string; layer: RenderLayer<unknown> }> | undefined;
    if (
      sceneCfg &&
      !isCustomEntry(sceneCfg) &&
      (sceneCfg as SceneSlotConfig<TNode, TPose>).drawOne
    ) {
      sceneLayers = buildSceneLayers<TNode, TPose>(
        sceneCfg,
        adapter,
        debugSink,
        effectiveBoundsOf,
        () => {
          const ids = aggregatePreviewIds(tools);
          const extra = previewExtraRef.current.previewIdsExtra?.();
          if (extra) {
            for (const id of extra) ids.add(id);
          }
          return ids.size > 0 ? ids : null;
        },
      );
    }

    const selSlot = layersMap.selectionOverlay as
      | SelectionOverlaySlotConfig<TPose>
      | CustomLayerEntry
      | null
      | undefined;
    if (isCustomEntry(selSlot)) {
      // Pre-built layer (e.g. from SceneCanvas) — pass through directly.
      standardLayers.selectionOverlay = selSlot.layer;
    } else if (selSlot !== null) {
      const cfg = (selSlot ?? {}) as SelectionOverlaySlotConfig<TPose>;
      // Resolver returns either a real TPose (use geometry.getBounds) or a
      // pre-projected Bounds (multi-union and the bounds-from-overlay path).
      // We tag the latter so the overlay's getBounds short-circuits.
      const poseById =
        cfg.poseById ??
        ((id: string): TPose | null => {
          // Active tool's overlay (move/resize/rotate ghost) wins so the
          // selection chrome tracks the in-flight pose during a drag.
          const tp = previewToolPose(id);
          if (tp != null) return tp;
          // Tool-supplied bounds (e.g. `useSelectTool`'s multi-union for
          // `MULTI_RESIZE_TARGET_ID`) are pre-projected Bounds; the overlay's
          // `getBounds` (below) short-circuits the rect-as-TPose case via
          // the `multiActive` flag.
          const tb = previewToolBounds(id);
          if (tb != null) return tb as unknown as TPose;
          // The synthetic multi-resize union is resolved by the overlay layer
          // from `ChromeState.unionBounds` at draw time — the single owner of
          // the union AABB, shared with the affordance hit-tester so painted
          // chrome and its hit region agree. Multi selections committed by
          // sibling tools (lasso, custom area-select) get their union chrome
          // through that same path, with no inline re-derivation here.
          if (!adapter) {
            if (effectiveBoundsOf) {
              const b = effectiveBoundsOf(id);
              return (b as unknown as TPose) ?? null;
            }
            return null;
          }
          try {
            return adapter.getPose(id);
          } catch {
            return null;
          }
        });
      const getSelection = multiActive
        ? (): readonly NodeId[] => [MULTI_RESIZE_TARGET_ID as NodeId]
        : (): readonly NodeId[] => selectedIds as readonly NodeId[];
      // Per-item outline pass: in multi mode, the handle pass works against
      // the synthetic union id, but the outline pass still wants the real
      // member ids so each selected object reads as "this is selected." In
      // single mode the two coincide.
      const getOutlineIds = multiActive
        ? (): readonly NodeId[] => selectedIds as readonly NodeId[]
        : undefined;
      standardLayers.selectionOverlay = createSelectionOverlayLayer<TPose>({
        ...cfg,
        getSelection,
        ...(getOutlineIds ? { getOutlineIds } : {}),
        getPose: poseById,
        getBounds:
          cfg.getBounds ??
          ((p: TPose): Bounds => {
            // Multi-union path returns a pre-projected Bounds masquerading as
            // TPose; treat that case as identity. For real TPose, defer to
            // the configured geometry.
            if (multiActive) return p as unknown as Bounds;
            return geometry.getBounds(p);
          }),
      });
    }

    const effectiveLayersMap = backgroundLayer
      ? { ...layersMap, backgroundFill: { layer: backgroundLayer, before: 'scene' } }
      : layersMap;
    const out: RenderLayer<unknown>[] = composeOrderedLayers(effectiveLayersMap, standardLayers, sceneLayers);
    // Decoration layer: above scene, below tool overlay (per slot ordering doc).
    if (decorationLayer) out.push(decorationLayer);
    if (tools) {
      placeToolOverlays(out, standardLayers.selectionOverlay, tools.getActiveOverlays);
    }
    return out;
  }, [layersMap, adapter, selectedIds, effectiveBoundsOf, multiActive, debugSink, tools, backgroundLayer,
      decorationLayer, geometry, previewToolBounds, previewToolPose]);

  // Append the debug overlay layer at the very top of the stack when debug
  // is enabled. The layer reads from `debugSink.snapshot()` and paints in
  // screen space.
  const layersWithDebug = useMemo(() => {
    const base = debugSink && resolvedDebugConfig
      ? [...layers, createDebugOverlayLayer({ sink: debugSink, config: resolvedDebugConfig })]
      : layers;
    return [...base, ...extrasRef.current];
    // redrawNonce drives re-reads of extrasRef when layers are registered/detached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, debugSink, resolvedDebugConfig, redrawNonce]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    // Clear sink at the top of every paint so per-frame records don't leak.
    debugSink?.beginFrame();
    if (debugSink) {
      const arr = layersWithDebug;
      for (let i = 0; i < arr.length; i++) {
        const layer = arr[i];
        if (layer.id === 'debug-overlay') continue;
        debugSink.recordLayer(layer.id, layer.label, layer.space ?? 'world', i);
      }
    }

    let renderer = glRendererRef.current;
    if (!renderer) {
      const dpr = dprProp ?? (window.devicePixelRatio || 1);
      const gl = c.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
      if (!gl || typeof (gl as Partial<WebGL2RenderingContext>).enable !== 'function') {
        // jsdom or unsupported environment — bail silently (test envs hit
        // this; jsdom returns a non-null stub but lacks WebGL2 methods).
        return;
      }
      try {
        renderer = new WeaselRenderer({
          gl: gl as WebGL2RenderingContext,
          canvas: c,
          width,
          height,
          dpr,
        });
      } catch {
        // Test env or context creation failure — bail silently.
        return;
      }
      glRendererRef.current = renderer;
      lastResizeRef.current = { w: width, h: height, dpr };
      // Shader registration is handled entirely by the shaderIdKey effect below;
      // do not call registerShadersOnRenderer here to avoid double compilation.
    } else {
      const dpr = dprProp ?? (window.devicePixelRatio || 1);
      const last = lastResizeRef.current;
      if (!last || last.w !== width || last.h !== height || last.dpr !== dpr) {
        renderer.resize({ width, height, dpr });
        lastResizeRef.current = { w: width, h: height, dpr };
      }
    }

    const commands = drawLayers(
      layersWithDebug,
      helpersForLayersRef.current,
      {},
      undefined,
      effectiveView,
      { width, height },
    );
    renderer.render(commands, viewToMat3(effectiveView));
  }, [layersWithDebug, width, height, effectiveView, debugSink, redrawNonce, dprProp]);

  // The GL context and everything it owns (programs, texture caches, VBOs)
  // outlive React state, so unmount has to free them explicitly or a
  // remounting host walks into the browser's live-context cap.
  useEffect(() => () => {
    glRendererRef.current?.dispose();
    glRendererRef.current = null;
    lastResizeRef.current = null;
  }, []);

  const shaderIdKey = shaders?.map((h) => h.id).join('|') ?? '';
  useEffect(() => {
    const renderer = glRendererRef.current;
    if (!renderer) return;
    registerShadersOnRenderer(renderer, shaders);
    // shaderIdKey is a stable string derived from handle ids — avoids
    // recompiling when the parent passes a new array literal each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderIdKey]);

  const toolsCursor = tools ? resolveToolsCursor(tools, toolsCtxBase) : undefined;
  const effectiveStyle: React.CSSProperties | undefined = toolsCursor
    ? { ...style, cursor: toolsCursor }
    : style;

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        tabIndex={tabIndex}
        className={className}
        style={effectiveStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        // Suppress the browser's default right-click menu over the canvas.
        // Canvases are interaction surfaces; the browser's context menu
        // (Save Image / Inspect Element / etc.) is almost never what the
        // user wants, and right-click is a useful gesture surface that
        // tools may consume. Consumers using right-click for their own
        // gestures should add their own onContextMenu handler — calling
        // `e.preventDefault()` is the no-op default; calling something
        // else still works (this handler runs before the default menu).
        onContextMenu={(e) => e.preventDefault()}
      />
      {cursorCoordsHud && (
        <CursorCoordsHud canvasRef={canvasRef} viewRef={viewRef} />
      )}
      {pickHud && (
        <PickHud
          canvasRef={canvasRef}
          viewRef={viewRef}
          pickEvery={stablePickEveryForHud}
          pickBest={stablePickBestForHud}
        />
      )}
      {modalityHud && (
        <ModalityHud
          canvasRef={canvasRef}
          modeId={typeof modalityHud === 'object' ? modalityHud.modeId : undefined}
        />
      )}
    </>
  );
}

/**
 * Forward-ref'd `<canvas>` wrapper. Generic over the object and pose types —
 * TypeScript will infer them from the `adapter` (or `move`/`resize`) prop.
 */
export const Canvas = forwardRef(CanvasInner) as <
  TNode extends { id: string } = { id: string },
  TPose = TNode,
>(
  props: CanvasProps<TNode, TPose> & { ref?: React.ForwardedRef<CanvasExtensionApi> },
) => ReturnType<typeof CanvasInner>;
