/**
 * Top-level `<Canvas>` component that wraps a single `<canvas>` element with:
 *   - WebGL renderer instantiation (`WeaselRenderer`)
 *   - background fill on every render
 *   - layer-stack composition from a map of named slots + custom layers
 *   - internal `useSelection` (overridable)
 *   - pointer/keyboard/wheel routing through `tools.dispatcher`
 *   - keyboard-focus plumbing (`tabIndex` + auto-focus on pointerdown)
 *
 * The `layers` prop is a map keyed by slot name. Standard slots render at a
 * canonical position; custom entries (any other key, value carrying `.layer`)
 * insert at `after`/`before` an existing slot, defaulting to the top.
 *
 * @internal
 * @deprecated Use `<SceneCanvas>` instead. Bare `<Canvas>` has no
 * scene-mutation signal — the only way to drive 60Hz repaints is forcing
 * React re-renders, which churns the tools machinery enough to wedge after
 * settle. `<SceneCanvas>` over a `useScene()` tree is the consumer entry
 * point; `<Canvas>` is retained as an internal implementation detail and
 * will be removed from the public surface in a future release.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { FillStyle } from 'core/paint-types';
import { composeOrderedLayers } from './layerOrder';
import {
  STANDARD_SLOTS,
  isCustomEntry,
  type CustomLayerEntry,
} from './layerSlots';
export { STANDARD_SLOTS, isCustomEntry } from './layerSlots';
export type { StandardSlotName, CustomLayerEntry } from './layerSlots';
import type { CanvasExtensionApi } from './canvasExtension';
import type { ToolsApi } from 'tools/useTools';
import type { AnyTool } from 'tools/types';
import type { ToolsDispatcher } from 'tools/dispatcher';
import type { ToolCtx } from 'tools/types';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { NodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { clampView } from 'core/viewport/clampView';
import { drawLayers, type RenderLayer } from 'core/layers/render';
import { WeaselRenderer, viewToMat3, type DrawCommand, type ShaderProgramHandle } from '../renderer';
import {
  useSelection,
  type SelectionApi,
  type UseSelectionOptions,
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
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/useSelectTool';
import { buildSceneTree } from './buildSceneTree';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { usePinchZoomTool } from 'tools/builtin/usePinchZoomTool';
import type { ViewportConfig } from './SceneCanvas/useViewportTools';



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

export type LayerSlotValue<TNode extends { id: string }, TPose> =
  | StandardSlotConfig<TNode, TPose>
  | CustomLayerEntry
  | null;

export type LayersMap<TNode extends { id: string }, TPose> = {
  grid?: GridSlotConfig | null;
  scene?: SceneSlotConfig<TNode, TPose> | null;
  selectionOverlay?: SelectionOverlaySlotConfig<TPose> | null;
} & {
  [customKey: string]: LayerSlotValue<TNode, TPose> | undefined;
};

/**
 * High-level selection semantics. A single switch the consumer flips to
 * pick the click/drag/resize behavior for the canvas:
 *
 *   - `'single'` (default) — click replaces the selection with one id; drag
 *     moves it; resize handles operate on it. Shift-click does nothing extra.
 *   - `'multi'` — shift-click extends/toggles the selection. When the
 *     selection has more than one id, the overlay draws a single union AABB
 *     with corner handles, clicks inside the union (without hitting an
 *     unselected leaf) drag the whole set, and corner handles resize the
 *     union (each member is scaled via the same `geom.remapBounds` path
 *     group resize uses).
 *   - `'none'` — selection state never updates from canvas interactions;
 *     consumers can still do their own picking via the active tool.
 *
 * Escape hatches still apply: explicit `selection`, `pickEvery`, `boundsOf`,
 * or `selectionOptions.mode` override the `selectionMode`-derived defaults.
 */
export type CanvasSelectionMode = 'single' | 'multi' | 'none';


/** Props for the top-level `<Canvas>` component — combines viewport, scene, gesture controllers, and slot overrides. */
export interface CanvasProps<TNode extends { id: string } = { id: string }, TPose = unknown> {
  /** CSS-pixel width. */
  width: number;
  /** CSS-pixel height. */
  height: number;

  /** Combined adapter. Required for the scene slot, default pickEvery/boundsOf,
   *  and the internal move/resize/rotate controllers. Optional for trivial
   *  canvases. `<SceneCanvas>` synthesizes this from a `Scene`; bare-`<Canvas>`
   *  consumers must supply it explicitly. Insert and area-select live entirely
   *  in `useInsertTool` / `useSelectTool` now; pass those via
   *  `tools={useTools(...)}` instead. */
  adapter?: MoveAdapter<TNode, TPose>
    & ResizeAdapter<TNode, TPose>
    & RotateAdapter<TNode, TPose>;

  /** Selection semantics. See {@link CanvasSelectionMode}. Default `'single'`. */
  selectionMode?: CanvasSelectionMode;

  /** Layer map. See module docstring for slot semantics. */
  layers: LayersMap<TNode, TPose>;

  // --- Internal hook configuration ---
  selection?: SelectionApi;
  selectionOptions?: UseSelectionOptions;

  /** Pose↔bounds projection. When supplied, drives default `pickEvery`,
   *  `boundsOf`, and the selection-overlay bounds source so non-rect TPose
   *  (e.g. `Path`) doesn't require per-prop overrides. Defaults to the rect
   *  identity. */
  geometry?: PoseProjection<TPose>;

  // --- Gesture overrides (escape hatches for non-rect / group-aware apps) ---
  pickEvery?: (worldX: number, worldY: number) => string | string[] | null;
  boundsOf?: (id: string) => Bounds | null;
  clientToWorld?: (canvas: HTMLCanvasElement, cx: number, cy: number) => [number, number];

  // --- Visuals / DOM passthrough ---
  background?: string;
  className?: string;
  style?: React.CSSProperties;
  tabIndex?: number;
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
  /** Optional world-space rect that constrains pan. When supplied, every
   *  `setView` call passes through `clampView(next, viewBounds, {width, height})`
   *  before commit, keeping the visible rect inside `viewBounds`. If the visible
   *  rect is larger than the bounds along an axis (zoomed out past extent), that
   *  axis is centered. Has no effect on `scale` — wire `useZoom` bounds for that. */
  viewBounds?: { x: number; y: number; width: number; height: number };
  /** Mutable ref Canvas writes overlay-aware pose/bounds lookups to on every
   *  render. Custom layers can read it from inside their `draw` closure to
   *  reflect in-flight gestures (move/resize/rotate) instead of the committed
   *  scene. Both lookups apply when an id is in the active overlay; otherwise
   *  they fall back to the adapter. */
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
   * handles: as legacy hooks are removed from tools (Phase 14e Task 3), the
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
   * Extra preview-bounds lookup checked after `previewBoundsExtra`'s `previewPose`
   * fallback. Same shape as `previewPoseExtra` but returns AABB directly,
   * preferred when the in-flight handle can produce bounds without going
   * through geometry.getBounds(pose).
   */
  previewBoundsExtra?: (id: string) => Bounds | null;

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
}

/** Live overlay-aware lookups exposed to custom layers via `helpersRef`. */
export interface CanvasHelpers<TPose> {
  /** Pose currently displayed for `id` — drag/resize/rotate overlay if active,
   *  otherwise the committed pose from the adapter. Returns `null` if the id
   *  isn't known. */
  getEffectivePose(id: string): TPose | null;
  /** Overlay-aware bounds for `id`. */
  getEffectiveBounds(id: string): Bounds | null;
  /** Returns the live ChromeState built once per render. Affordances and
   *  custom layers that need overlay-aware selection state (selection ids,
   *  bounds, multi-union AABB, modifier flags) read from this. */
  getChromeState(): ChromeState;
  /** Active debug sink, when `<Canvas debug=...>` is enabled. Layers that
   *  want to participate in `hitboxes`/`bounds`/etc. visualization can
   *  call into this from their `draw` callback. Returns `null` when
   *  debug is off — no-op for production renders. */
  getDebug(): DebugSink | null;
}

// Walks every registered + ambient tool: resize/rotate will register as
// siblings of select, each publishing its own preview slice.
function* toolsInPriorityOrder(tools: ToolsApi): IterableIterator<AnyTool> {
  const seen = new Set<AnyTool>();
  const hotkey = tools.hotkeyEngaged ? tools.registry[tools.hotkeyEngaged] : undefined;
  const active = tools.registry[tools.active];
  for (const t of [hotkey, active]) {
    if (t && !seen.has(t)) { seen.add(t); yield t; }
  }
  for (const t of Object.values(tools.registry)) {
    if (t && !seen.has(t)) { seen.add(t); yield t; }
  }
  for (const t of tools.ambient) {
    if (t && !seen.has(t)) { seen.add(t); yield t; }
  }
}

function firstPreviewPose(tools: ToolsApi | undefined, id: string): unknown {
  if (!tools) return null;
  for (const t of toolsInPriorityOrder(tools)) {
    const p = t.previewPose?.(id);
    if (p != null) return p;
  }
  return null;
}

function firstPreviewBounds(tools: ToolsApi | undefined, id: string): Bounds | null {
  if (!tools) return null;
  for (const t of toolsInPriorityOrder(tools)) {
    const b = t.previewBounds?.(id);
    if (b) return b as Bounds;
  }
  return null;
}

function aggregatePreviewIds(tools: ToolsApi | undefined): Set<string> {
  const out = new Set<string>();
  if (!tools) return out;
  for (const t of toolsInPriorityOrder(tools)) {
    const ids = t.previewIds?.();
    if (!ids) continue;
    for (const id of ids) out.add(id);
  }
  return out;
}

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
  adapter:
    | (MoveAdapter<TNode, TPose> & ResizeAdapter<TNode, TPose> & RotateAdapter<TNode, TPose>)
    | undefined,
  debugSink: DebugSink | null,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
  hideIds: () => Set<string> | null,
): RenderLayer<unknown> {
  const toPose =
    cfg.toPose ??
    ((obj: TNode) => (adapter ? adapter.getPose(obj.id) : (obj as unknown as TPose)));
  const drawOne = cfg.drawOne;
  return {
    id: 'scene',
    label: 'Scene',
    draw: (_data, view) => {
      const hidden = hideIds();
      const a = adapter as unknown as {
        getLayers?: () => readonly { id: string; visible: boolean }[];
        getNode?: (id: string) => unknown;
        getChildren?: (parentId: string | null) => readonly string[];
        getPose?: (id: string) => TPose;
      };
      if (
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
          return cmds;
        };
        // Honor cfg.toPose on the hierarchical path by shimming getPose on the
        // adapter so buildSceneTree routes through it instead of the raw adapter.
        const hierarchicalAdapter = cfg.toPose
          ? {
              ...a,
              getPose: (id: string) => {
                const obj = a.getNode!(id);
                return obj ? toPose(obj as TNode) : a.getPose!(id);
              },
            }
          : a;
        return [{
          kind: 'group',
          transform: viewToMat3(view),
          children: buildSceneTree(
            hierarchicalAdapter as Parameters<typeof buildSceneTree>[0],
            filteredDrawOne as unknown as Parameters<typeof buildSceneTree>[1],
            view,
          ),
        }];
      }
      // Flat fallback — keep existing body verbatim.
      const objects = cfg.objects ?? adapter?.getNodes() ?? [];
      const children: DrawCommand[] = [];
      for (const obj of objects) {
        if (hidden && hidden.has(obj.id)) continue;
        const pose: TPose = toPose(obj);
        if (drawOne) {
          for (const cmd of drawOne(obj, pose, view)) children.push(cmd);
        }
        if (debugSink) {
          const b = boundsOfFn ? boundsOfFn(obj.id) : null;
          if (b) debugSink.recordBounds(obj.id, { x: b.x, y: b.y, width: b.width, height: b.height });
          const ox = (pose as { x?: number }).x ?? (b ? b.x : 0);
          const oy = (pose as { y?: number }).y ?? (b ? b.y : 0);
          debugSink.recordOrigin(obj.id, { x: ox, y: oy });
        }
      }
      return [{
        kind: 'group',
        transform: viewToMat3(view),
        children,
      }];
    },
  };
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
  // Function form: invoke at render time with the live base ctx and the
  // dispatcher's current scratch (if a gesture is in flight). Gesture phase
  // transitions bump `tools.gestureTick`, which forces a re-render so the
  // cursor re-resolves mid-drag (e.g. grab→grabbing).
  try {
    const base = ctxBase();
    const scratch = tools.dispatcher.getActiveScratch?.() ?? null;
    return tool.cursor({ ...base, scratch });
  } catch {
    return undefined;
  }
}

function CanvasInner<TNode extends { id: string }, TPose>(
  props: CanvasProps<TNode, TPose>,
  ref: React.ForwardedRef<CanvasExtensionApi>,
) {
  const {
    width,
    height,
    adapter: adapterProp,
    selectionMode = 'single',
    layers: layersMap,
    selection: selectionOverride,
    selectionOptions,
    boundsOf,
    pickEvery,
    clientToWorld,
    geometry = AUTO_POSE_DESCRIPTOR as unknown as PoseProjection<TPose>,
    background,
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
    previewBoundsExtra,
    viewport,
    backgroundFill,
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

  useImperativeHandle(ref, () => ({
    element: canvasRef.current,
    requestRedraw,
    registerLayer,
  }), [canvasRef, requestRedraw, registerLayer]);

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

  const derivedSelectionOptions = useMemo<UseSelectionOptions>(() => {
    const base = selectionOptions ?? {};
    if (base.mode !== undefined) return base;
    if (selectionMode === 'multi') return { ...base, mode: 'multi' };
    return base;
  }, [selectionOptions, selectionMode]);

  const internalSelection = useSelection(derivedSelectionOptions);
  const baseSelection: SelectionApi = selectionOverride ?? internalSelection;

  // selectionMode === 'none' wraps the selection so canvas interactions can't
  // mutate it. Consumers that want the underlying api still use their own
  // override or read from `useSelection` directly.
  const effectiveSelection: SelectionApi = useMemo(() => {
    if (selectionMode !== 'none') return baseSelection;
    const noopSet = () => {};
    return {
      ...baseSelection,
      set: noopSet,
      add: noopSet,
      remove: noopSet,
      toggle: noopSet,
      clear: noopSet,
      applyClick: noopSet,
    };
  }, [baseSelection, selectionMode]);

  // Build the per-event base ctx the tools dispatcher injects into handlers.
  // Refs so identity stays stable while the underlying values update.
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
        const cw = clientToWorldRef.current;
        if (cw) {
          [worldX, worldY] = cw(c, cx, cy);
        } else {
          const rect = c.getBoundingClientRect();
          worldX = (cx - rect.left) / view.scale.x + view.x;
          worldY = (cy - rect.top) / view.scale.y + view.y;
        }
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

  // If a tools prop was passed, mutate its dispatcher's ctx supplier so
  // handlers see the live selection/adapter/applyOps — useTools's own
  // default ctx is the empty test stub.
  useEffect(() => {
    if (!tools) return;
    // Small monkey-patch: replace the dispatcher's getCtx by re-creating it.
    // Phase 2 cleanup: thread getCtx through useTools properly so this isn't needed.
    const d = tools.dispatcher as ToolsDispatcher & {
      __setGetCtx?: (fn: (overrides?: { clientX?: number; clientY?: number; modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean } }) => unknown) => void;
      __setHitTestContext?: (fn: (() => {
        layers: readonly RenderLayer<unknown>[];
        chromeState: ChromeState;
        view: View;
        dims: { width: number; height: number };
      } | null) | undefined) => void;
    };
    d.__setGetCtx?.(toolsCtxBase);
  }, [tools, toolsCtxBase]);

  // Wire the dispatcher's scene hit-test (ctx.target population on pointer
  // events). Builds a NodeHit/EmptyHit from the effective pickEvery + adapter
  // so declarative routing factories can match on `target.kind`
  // ('rect'/'text'/'path'/'empty') from any pointer event. The closure reads
  // refs so it always sees the latest pickEvery / adapter without re-installing
  // the setter on every prop change.
  const pickEveryRef = useRef(pickEvery);
  pickEveryRef.current = pickEvery;
  useEffect(() => {
    if (!tools) return;
    const d = tools.dispatcher as ToolsDispatcher & {
      __setGetNodeAtPoint?: (
        fn: ((worldX: number, worldY: number) =>
          | { id: NodeId; kind: string; pose: unknown; data: unknown; meta?: Record<string, unknown> }
          | null) | undefined,
      ) => void;
    };
    d.__setGetNodeAtPoint?.((wx, wy) => {
      const pe = pickEveryRef.current;
      if (!pe) return null;
      const raw = pe(wx, wy);
      // Normalize `string | string[] | null` to topmost id (first entry).
      const id = Array.isArray(raw) ? raw[0] ?? null : raw;
      if (id == null) return null;
      // `a.kindOf?.(id)` is populated by SceneCanvas from its `kinds` prop
      // (see docs/superpowers/specs/2026-05-21-node-kind-registry-design.md).
      // Bare-Canvas consumers may still set adapter.kindOf directly as a
      // deprecated escape hatch; the field is typed on SceneCanvasAdapter
      // as optional and reads `'unknown'` when unset.
      const a = effectiveAdapterRefForCtx.current as typeof effectiveAdapterRefForCtx.current & {
        kindOf?: (id: string) => string;
        getNode?: (id: string) => unknown;
      };
      const kind = a.kindOf?.(id) ?? 'unknown';
      const pose = a.getPose(id);
      const data = a.getNode?.(id) ?? { id };
      return { id: id as NodeId, kind, pose, data };
    });
    return () => {
      d.__setGetNodeAtPoint?.(undefined);
    };
  }, [tools]);

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
  const multiActive = selectionMode === 'multi' && selectedIdsForWiring.length > 1;

  // Hold the latest dispatcher-side preview extras in a ref so chromeState's
  // closure reads live values without forcing the memo to rebuild every render.
  const previewExtraRef = useRef({ previewPoseExtra, previewBoundsExtra });
  previewExtraRef.current = { previewPoseExtra, previewBoundsExtra };

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
        if (extras.previewBoundsExtra) {
          const b = extras.previewBoundsExtra(id);
          if (b) return b;
        }
        if (extras.previewPoseExtra) {
          const p = extras.previewPoseExtra(id);
          if (p != null) return geometry.getBounds(p as TPose);
        }
        return effectiveBoundsOf ? effectiveBoundsOf(id) : null;
      },
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    }),
    [selectedIdsForWiring, multiActive, effectiveBoundsOf, tools, geometry],
  );

  // Wire the dispatcher's hit-test context. The active tool's overlay (and
  // hotkey/ambient overlays) are the affordance-layer pipeline: overlays
  // that publish a `hitTest` (e.g. select tool's corner-resize affordance)
  // get walked top-down on pointerdown so cross-tool hits (lasso → corner
  // resize) route through the affordance instead of the foreground tool's
  // drag.onStart. The closure reads refs so it always sees the latest
  // layers / chromeState / view / dims without re-installing on every
  // paint.
  const hitTestRefs = useRef({ tools, chromeState, view: effectiveView, width, height });
  hitTestRefs.current = { tools, chromeState, view: effectiveView, width, height };
  useEffect(() => {
    if (!tools) return;
    const d = tools.dispatcher as ToolsDispatcher & {
      __setHitTestContext?: (fn: (() => {
        layers: readonly RenderLayer<unknown>[];
        chromeState: ChromeState;
        view: View;
        dims: { width: number; height: number };
      } | null) | undefined) => void;
    };
    d.__setHitTestContext?.(() => {
      const r = hitTestRefs.current;
      if (!r.tools) return null;
      // `getActiveOverlays` returns [active, hotkey?, ...ambient]; reverse
      // for top-down so the foreground-most tool's affordances fire first.
      const overlays = r.tools.getActiveOverlays();
      const extras = Array.from(extrasRef.current);
      // Top-down walk order: extras first (HUDs on top), then tool overlays
      // (reversed so foreground-most tool's overlays fire before ambient ones).
      return {
        layers: [...extras, ...overlays.reverse()],
        chromeState: r.chromeState,
        view: r.view,
        dims: { width: r.width, height: r.height },
      };
    });
    return () => {
      d.__setHitTestContext?.(undefined);
    };
  }, [tools]);

  // helpersForLayers: overlay-aware lookups passed to every RenderLayer.draw
  // call (as the `data` arg) so custom layers can read live overlay state
  // directly from their draw closure. The legacy `helpersRef` prop still
  // mirrors the same value for back-compat. The active Tool's `previewPose`/
  // `previewBounds` is the only overlay source post-cleanup; falls through to
  // the committed adapter pose / bounds when no tool is mid-gesture.
  const previewToolPose = (id: string): TPose | null => {
    if (tools) {
      const p = firstPreviewPose(tools, id);
      if (p != null) return p as TPose;
    }
    if (previewPoseExtra) {
      const p = previewPoseExtra(id);
      if (p != null) return p as TPose;
    }
    return null;
  };
  const previewToolBounds = (id: string): Bounds | null => {
    if (tools) {
      const b = firstPreviewBounds(tools, id);
      if (b) return b;
      const p = firstPreviewPose(tools, id);
      if (p != null) return geometry.getBounds(p as TPose);
    }
    if (previewBoundsExtra) {
      const b = previewBoundsExtra(id);
      if (b) return b;
    }
    if (previewPoseExtra) {
      const p = previewPoseExtra(id);
      if (p != null) return geometry.getBounds(p as TPose);
    }
    return null;
  };

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
    getChromeState: () => chromeState,
    getDebug: () => debugSink,
  };
  if (helpersRef) helpersRef.current = helpersForLayers;

// Keyboard routing through the dispatcher when tools is set.
  useEffect(() => {
    if (!tools) return;
    const onDown = (e: KeyboardEvent) => tools.dispatcher.onKeyDown(e);
    const onUp = (e: KeyboardEvent) => tools.dispatcher.onKeyUp(e);
    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);
    return () => {
      document.removeEventListener('keydown', onDown);
      document.removeEventListener('keyup', onUp);
    };
  }, [tools]);

  // Document-level pointerup/pointercancel backstop for the tools dispatcher.
  // The dispatcher is a pure in-memory state machine — it doesn't attach DOM
  // listeners. React's onPointerUp on the canvas only fires when the canvas is
  // still the event target; if the user moves off-canvas and releases there,
  // the pointerup lands on document and the dispatcher never sees it, leaving
  // the gesture in flight (move-overlay ghost leaks, no commit).
  //
  // Mirrors the doc-listener pattern in usePointerGestures.attachDocListeners
  // (see the comments there): we don't rely on setPointerCapture or
  // lostpointercapture because their ordering vs. pointerup is not reliable
  // when mid-drag re-renders drop implicit capture.
  //
  // Listeners are attached on gesture start (pointerdown that the dispatcher
  // accepted) and detached on the matching up/cancel. They forward to the
  // dispatcher exactly like the React handlers — endActiveGesture-equivalent
  // logic lives entirely inside the dispatcher's onPointerUp.
  const docListenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: (e: PointerEvent) => void;
  } | null>(null);
  const detachDocListeners = useCallback(() => {
    const ls = docListenersRef.current;
    if (!ls) return;
    document.removeEventListener('pointermove', ls.move);
    document.removeEventListener('pointerup', ls.up);
    document.removeEventListener('pointercancel', ls.cancel);
    docListenersRef.current = null;
  }, []);
  const attachDocListeners = useCallback((dispatcher: ToolsDispatcher) => {
    if (docListenersRef.current) return;
    const canvas = canvasRef.current;
    // Forward pointermove too: the React onPointerMove on the canvas only
    // fires while the cursor is over the canvas. Without doc-level forwarding,
    // a drag whose pointer leaves the canvas would freeze (no move events,
    // no threshold promotion if still pending) until the user wanders back.
    //
    // Skip events whose target is the canvas — those are already routed via
    // the React onPointerMove handler, and dispatching twice per move would
    // double-fire drag.onMove. The same de-dupe applies to pointerup: when
    // the release lands on the canvas, the React handler runs first; the
    // doc listener sees the bubbled event and bails because dispatcher's
    // gesture is already consumed (hasActiveGesture() === false).
    const isCanvasTarget = (ev: PointerEvent) => ev.target === canvas;
    const move = (ev: PointerEvent) => {
      if (isCanvasTarget(ev)) return;
      dispatcher.onPointerMove(ev);
    };
    const up = (ev: PointerEvent) => {
      if (isCanvasTarget(ev)) return; // React onPointerUp already handled it
      dispatcher.onPointerUp(ev);
      detachDocListeners();
    };
    const cancel = (_ev: PointerEvent) => {
      dispatcher.cancelGesture();
      detachDocListeners();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    docListenersRef.current = { move, up, cancel };
  }, [detachDocListeners]);
  // Detach on unmount (no leaked global listeners if Canvas tears down mid-drag).
  useEffect(() => detachDocListeners, [detachDocListeners]);

  const handlePointerDown = tools
    ? (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (autoFocusOnPointerDown) e.currentTarget.focus();
        tools.dispatcher.onPointerDown(e.nativeEvent);
        // Only attach if the dispatcher actually started a gesture; otherwise
        // we'd leak a listener for every empty click on the canvas.
        if (tools.dispatcher.hasActiveGesture()) attachDocListeners(tools.dispatcher);
      }
    : undefined;
  const handlePointerMove =
    ((e: React.PointerEvent<HTMLCanvasElement>) => {
      tools?.dispatcher.onPointerMove(e.nativeEvent);
      // Dispatch onUncapturedMove to layers when no gesture is captured.
      const gestureActive = tools?.dispatcher.hasActiveGesture() ?? false;
      if (!gestureActive) {
        const c = e.currentTarget;
        const view = viewRef.current;
        const cw = clientToWorldRef.current;
        let worldX: number;
        let worldY: number;
        if (cw) {
          [worldX, worldY] = cw(c, e.clientX, e.clientY);
        } else {
          const rect = c.getBoundingClientRect();
          worldX = (e.clientX - rect.left) / view.scale.x + view.x;
          worldY = (e.clientY - rect.top) / view.scale.y + view.y;
        }
        for (const layer of layersWithDebug) {
          layer.onUncapturedMove?.(worldX, worldY, e.nativeEvent, view, { width, height });
        }
      }
    });
  const handlePointerLeave = (_e: React.PointerEvent<HTMLCanvasElement>) => {
    for (const layer of layersWithDebug) layer.onUncapturedLeave?.();
  };
  const handlePointerUp = tools
    ? (e: React.PointerEvent<HTMLCanvasElement>) => {
        tools.dispatcher.onPointerUp(e.nativeEvent);
        // The doc-listener up handler also detaches; this branch covers the
        // common case where the release lands on the canvas itself.
        detachDocListeners();
      }
    : undefined;
  const handlePointerCancel = undefined;
  // Native non-passive wheel listener so tools can call event.preventDefault()
  // (e.g. wheel-zoom holding Ctrl). React attaches `onWheel` as passive, which
  // would emit "Unable to preventDefault inside passive event listener" warnings.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !tools) return;
    const onWheelNative = (event: WheelEvent) => tools.dispatcher.onWheel(event);
    c.addEventListener('wheel', onWheelNative, { passive: false });
    return () => c.removeEventListener('wheel', onWheelNative);
  }, [tools]);

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

    const sceneCfg = layersMap.scene as SceneSlotConfig<TNode, TPose> | null | undefined;
    if (
      sceneCfg &&
      !isCustomEntry(sceneCfg) &&
      (sceneCfg as SceneSlotConfig<TNode, TPose>).drawOne
    ) {
      standardLayers.scene = buildSceneLayer<TNode, TPose>(
        sceneCfg,
        adapter,
        debugSink,
        effectiveBoundsOf,
        () => {
          const ids = aggregatePreviewIds(tools);
          const extra = previewIdsExtra?.();
          if (extra) {
            for (const id of extra) ids.add(id);
          }
          return ids.size > 0 ? ids : null;
        },
      );
    }

    const selSlot = layersMap.selectionOverlay as
      | SelectionOverlaySlotConfig<TPose>
      | null
      | undefined;
    if (selSlot !== null) {
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
          // Multi-union fallback: when no tool synthesizes the synthetic
          // multi-resize id (e.g. when active tool isn't `useSelectTool`),
          // Canvas computes it from the live selection. Without this, multi
          // selections committed by sibling tools (lasso, custom area-select)
          // wouldn't render their union AABB chrome.
          if (multiActive && id === MULTI_RESIZE_TARGET_ID && effectiveBoundsOf) {
            const ids = selectedIds;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let any = false;
            for (const sid of ids) {
              const b = effectiveBoundsOf(sid);
              if (!b) continue;
              any = true;
              if (b.x < minX) minX = b.x;
              if (b.y < minY) minY = b.y;
              if (b.x + b.width > maxX) maxX = b.x + b.width;
              if (b.y + b.height > maxY) maxY = b.y + b.height;
            }
            if (any) {
              return { x: minX, y: minY, width: maxX - minX, height: maxY - minY } as unknown as TPose;
            }
            return null;
          }
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
    const out: RenderLayer<unknown>[] = composeOrderedLayers(effectiveLayersMap, standardLayers);
    if (tools) {
      out.push(...tools.getActiveOverlays());
    }
    return out;
  }, [layersMap, adapter, selectedIds, effectiveBoundsOf, multiActive, debugSink, tools, backgroundLayer]);

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
      const dpr = window.devicePixelRatio || 1;
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
      const dpr = window.devicePixelRatio || 1;
      const last = lastResizeRef.current;
      if (!last || last.w !== width || last.h !== height || last.dpr !== dpr) {
        renderer.resize({ width, height, dpr });
        lastResizeRef.current = { w: width, h: height, dpr };
      }
    }

    const commands = drawLayers(
      layersWithDebug,
      helpersForLayers,
      {},
      undefined,
      effectiveView,
      { width, height },
    );
    // Honor the `background` prop by prepending a screen-space rect command.
    if (background) {
      commands.unshift({
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width, height },
        fill: { color: background },
      });
    }
    renderer.render(commands);
  }, [layersWithDebug, width, height, background, effectiveView, debugSink, redrawNonce]);

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
