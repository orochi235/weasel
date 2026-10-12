/**
 * Low-level WebGL surface + viewport + pointer routing primitive. Composes layers into a single
 * GL render pass, applies a view transform, and routes pointer/keyboard events to the supplied
 * `tools.dispatcher`. Canvas owns NO scene-shaped state — selection, picking, kind registry,
 * scene-aware overlays all live in `<SceneCanvas>`, which wraps it.
 *
 * The `layers` prop is a map keyed by slot name. Standard slots render at a canonical position;
 * custom entries (any other key, value carrying `.layer`) insert at `after`/`before` an existing
 * slot, defaulting to the top.
 *
 * @internal
 * @deprecated Bare `<Canvas>` is not a supported consumer surface.
 *   Use `<SceneCanvas>` instead.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type React from 'react';
import type { Paint } from '@weasel-js/paint';
import { composeOrderedLayers, placeToolOverlays } from './layerOrder';
import { buildSceneLayers, type CanvasAdapter, type SceneSlotConfig } from './buildSceneLayer';

export { buildSceneLayer, buildSceneLayers } from './buildSceneLayer';
export type { SceneSlotConfig } from './buildSceneLayer';
import {
  STANDARD_SLOTS,
  isCustomEntry,
  type CustomLayerEntry,
} from './layerSlots';
export { STANDARD_SLOTS, isCustomEntry } from './layerSlots';
export type { StandardSlotName, CustomLayerEntry } from './layerSlots';
import type { CanvasExtensionApi } from './canvasExtension';
import { registerMountedCanvas } from './mountedCanvases';
import type { ToolsApi } from '../tools/overlayBinding';
import { aggregatePreviewIds } from './toolPreview';
import type { GestureSource } from './gestureBounds';
import { useViewHelpers } from './useViewHelpers';
import { useSurfaceInput } from './useSurfaceInput';
import { useCanvasView } from './useCanvasView';
import { useOptionalViewRegistry } from './viewRegistry';
import { useCanvasSurface } from './useCanvasSurface';
import type { CanvasHelpers, CanvasSurfaceHelpers } from './useViewHelpers';

import type { ToolCtx } from '@weasel-js/routing';
import { useLatest } from '@weasel-js/react';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { View } from 'core/viewport/view';
import { clientToWorld as clientToWorldHelper } from 'core/viewport/clientToWorld';
import {
  drawLayers, isLayerPainted,
  type Dims, type LayerCommandCache, type LayerGroup, type RedrawSource, type RenderLayer,
} from 'core/layers/render';
import { viewToMat3, type ShaderProgramHandle } from '@weasel-js/renderer';
import { createBackgroundFillLayer } from 'core/layers/backgroundFill';
import { shaderKeyOf } from './canvasRenderer';
import { useSceneLayerList } from './useSceneLayerList';
import {
  type SelectionApi,
} from 'core/selection/useSelection';
import type {
  MoveAdapter,
  ResizeAdapter,
  RotateAdapter,
} from 'core/adapters/types';
import {
  createSelectionOverlayLayer,
  type SelectionOverlayLayerOpts,
} from 'features/selection/overlay';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { CanvasDebugSink, DebugConfig } from '../debug/types';
import { beginDebugFrame, useDebugSink } from '../debug/useDebugSink';

const alwaysVisible = (_id: string): boolean => true;
import { resolveCursorTier } from '@weasel-js/cursor';
import type { ResolvedCursor } from '@weasel-js/cursor';
import { createPaintedCursorState } from '@weasel-js/cursor';
import type { PaintedCursor, PaintedCursorState } from '@weasel-js/cursor';
import { createPaintedCursorLayer } from './paintedCursorLayer';

import type { Bounds } from 'core/viewport/fitViewToBounds';
import { CursorCoordsHud } from './CursorCoordsHud';
import { PickHud } from './PickHud';
import { ModalityHud } from './ModalityHud';



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
 *  scene, selection overlay, cell highlight) fix where a layer sits in the
 *  stack; scene and selection overlay can be configured, and every one can be
 *  given a layer of your own or switched off. Further keys add custom layers.
 *  `TSceneSlot` is what the scene slot accepts: `<SceneCanvas>` takes a
 *  partial config and fills the rest from its defaults. */
export type LayersMap<
  TNode extends { id: string },
  TPose,
  TSceneSlot = SceneSlotConfig<TNode, TPose>,
> = {
  /** Grid slot, beneath the scene. Takes a pre-built layer (`{ layer }`) —
   *  e.g. `createGridLayer` from `@weasel-js/guides` — or `null`. */
  grid?: CustomLayerEntry | null;
  scene?: TSceneSlot | null;
  /** Selection-overlay slot. Canvas constructs the layer from a
   *  `SelectionOverlaySlotConfig`; pass a `CustomLayerEntry` (`{ layer }`) to
   *  supply a pre-built layer (e.g. from `<SceneCanvas>`). */
  selectionOverlay?: SelectionOverlaySlotConfig<TPose> | CustomLayerEntry | null;
  /** Cell-highlight overlay slot, drawn immediately after the grid. Takes a
   *  pre-built layer (`{ layer }`) — e.g. `createCellHighlightLayer` from
   *  `@weasel-js/guides` — or `null`. */
  cellHighlight?: CustomLayerEntry | null;
} & {
  [customKey: string]: LayerSlotValue<TNode, TPose> | TSceneSlot | undefined;
};

/**
 * Props for `<Canvas>`. Canvas is scene-agnostic: it owns the GL surface, view state,
 * pointer/keyboard dispatch, and slot composition, and not selection state, picking logic, kind
 * registries, or scene-aware overlays.
 */
export interface CanvasProps<TNode extends { id: string } = { id: string }, TPose = unknown> {
  /** CSS-pixel width. */
  width: number;
  /** CSS-pixel height. */
  height: number;

  /** Drawing-buffer density (device pixels per CSS pixel). When omitted the
   *  canvas reads `window.devicePixelRatio` per paint. */
  dpr?: number;

  /** Flatness tolerance for curve tessellation, in world units. Forwarded to
   *  `WeaselRendererOptions.flattenTolerance`. Leave unset for the cached
   *  default (`DEFAULT_FLATTEN_TOLERANCE`, 0.5); a scene whose world unit is
   *  not a pixel — feet, inches, millimetres — needs a value scaled to its
   *  unit or sub-unit curves flatten to a handful of vertices. */
  flattenTolerance?: number;

  /** The version of whatever content this canvas draws, sampled at paint time
   *  and reported by {@link CanvasExtensionApi.getPaintedVersion}.
   *  `<SceneCanvas>` wires this to `scene.getVersion`. Chrome that must not
   *  show DOM ahead of pixels compares the two and defers a frame. */
  contentVersion?: () => number;

  /** Paint inside the React commit rather than on the next animation frame.
   *  Costs a synchronous paint per commit and per redraw request; buys
   *  single-commit consistency between React-rendered DOM and canvas pixels.
   *  For consumers with DOM chrome pinned to canvas content that cannot
   *  tolerate a frame of skew. Live: toggling it switches modes from the next
   *  redraw on. A redraw requested from inside a layer's `draw`, or from a
   *  `subscribeFrame` callback, still waits for a frame — painting it in place
   *  would recurse. */
  syncPaint?: boolean;

  /** External state the paint reads that no layer declares — typically what
   *  an `alphaFor` consults. Each source is subscribed while mounted and
   *  repaints the canvas when it notifies. A layer that reads outside state
   *  declares it on `RenderLayer.subscribe` instead. */
  redrawOn?: readonly RedrawSource[];

  /**
   * Combined adapter for scene-slot rendering, bounds computation, and move/resize/rotate
   * gesture math. Required only for the scene or selection-overlay slots. The scene-tree
   * methods (`getLayers`/`getNode`/`getChildren`) are optional — present on a hierarchical
   * `SceneCanvasAdapter`, absent on flat adapters — and feature-detected at draw time.
   */
  adapter?: CanvasAdapter<TNode, TPose>;

  /** Layer map. See module docstring for slot semantics. */
  layers: LayersMap<TNode, TPose>;

  /**
   * Current selection state; Canvas owns none of its own. When absent, Canvas behaves as if
   * nothing is selected: no selection chrome, no select-on-click, no clear-on-background.
   */
  selection?: SelectionApi;


  /**
   * How to read and rewrite a pose. Drives the default `boundsOf` fallback and the
   * selection-overlay bounds. Defaults to the rect identity (`AUTO_POSE_DESCRIPTOR`); supply
   * one for a non-rect pose type.
   */
  poseDescriptor?: PoseDescriptor<TPose>;

  /**
   * Used by `PickHud` to display the list of ids under the cursor.
   * NOT used for tool routing — see `getNodeAtPoint` for that.
   */
  pickEvery?: (worldX: number, worldY: number) => string | string[] | null;
  /**
   * Override for committed bounds lookup, taking precedence over the `poseDescriptor`-derived
   * fallback. Used by the selection overlay, the multi-select union AABB, and
   * `helpersRef.getEffectiveBounds`.
   */
  boundsOf?: (id: string) => Bounds | null;
  /** Bounds of `id` drawn at an in-flight pose — how chrome boxes a preview.
   *  Defaults to the `poseDescriptor`'s box of that pose. */
  boundsOfPose?: (id: string, pose: TPose) => Bounds | null;
  /**
   * Custom pointer-to-world coordinate transform, overriding the default canvas-rect
   * calculation. Useful for consumers that apply an additional CSS transform to the canvas
   * element.
   */
  clientToWorld?: (canvas: HTMLElement, cx: number, cy: number) => [number, number];

  /**
   * Paint into a caller-owned canvas at a rect on it, instead of an element
   * this component creates. `x`/`y` are the rect's top-left in that canvas's
   * CSS pixels; the rect's size is the existing `width`/`height` props.
   *
   * Requires `inputElement`: with no element of its own there is nowhere for
   * pointer input, focus or the cursor to live, and nothing renders.
   *
   * N canvases can then share one GL context and one buffer.
   */
  paintInto?: { canvas: HTMLCanvasElement | null; x: number; y: number };
  /**
   * The element pointer input, focus and the cursor come from, and the element
   * every client→world conversion measures. Only read alongside `paintInto`;
   * an attached canvas uses the one it renders.
   */
  inputElement?: HTMLElement | null;

  /** Class for the `<canvas>` this component renders. Under `paintInto` it
   *  renders none, and the input element is the caller's to style. */
  className?: string;
  /** Inline style for the `<canvas>` this component renders; a tool's cursor
   *  is merged over it. Not applied under `paintInto`, where only that cursor
   *  is written, onto the input element. */
  style?: React.CSSProperties;
  /** Tab order of the `<canvas>` this component renders. Default 0, so the
   *  canvas is focusable. Not applied under `paintInto`: whether the input
   *  element can take focus is the caller's to decide. */
  tabIndex?: number;
  /** Fired when the element input comes from gains focus: the canvas, or
   *  under `paintInto` the `inputElement`. Called with the DOM event. */
  onFocus?: (event: FocusEvent) => void;
  /** Fired when that element loses focus. */
  onBlur?: (event: FocusEvent) => void;
  /**
   * When `true` (default), the canvas element receives focus on `pointerdown` so keyboard
   * events are captured without a separate click-to-focus step. Set to `false` where
   * auto-focus would steal focus from sibling inputs.
   */
  autoFocusOnPointerDown?: boolean;

  /** Tool primitive substrate. Pointer/keyboard/wheel events are routed
   *  through `tools.dispatcher`. */
  tools?: import('../tools/overlayBinding').ToolsApi;

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
   * Optional world-space rect that constrains pan: every `setView` passes through `clampView`
   * before commit, keeping the visible rect inside `viewBounds`. An axis where the visible
   * rect is larger than the bounds is centered. Has no effect on `scale`.
   */
  viewBounds?: { x: number; y: number; width: number; height: number };
  /**
   * Mutable ref Canvas writes overlay-aware pose/bounds lookups to on every render. Custom
   * layers can read it from inside their `draw` closure to reflect in-flight gestures
   * (move/resize/rotate) instead of the committed scene; an id outside the active overlay
   * falls back to the adapter.
   */
  helpersRef?: React.MutableRefObject<CanvasHelpers<TPose> | null>;

  /**
   * Debug overlay configuration.
   *  - `undefined` (default): read `?debug=…` from the URL.
   *  - `false`: force off, ignore URL.
   *  - `DebugConfig` object: force on with that config, ignore URL.
   *
   * When enabled, the Canvas appends a screen-space `debug-overlay` layer and threads a
   * `DebugSink` into every interaction hook so they record hit math + handle positions.
   */
  debug?: DebugConfig | false;

  /** Test-only escape hatch: writes the live debug sink to this ref so tests
   *  can call `snapshot()` after a render. No effect when debug is off. */
  debugSinkRef?: React.MutableRefObject<CanvasDebugSink | null>;

  /**
   * Shader programs to compile before the frame that first draws them; one
   * not named here compiles on that frame. Each handle comes from a
   * module-level `registerProgram()`. Pass a stable reference (e.g. defined
   * at module scope) — the array is read at renderer init time.
   * Re-registering one of these ids with new source repaints the canvas, and
   * the renderer recompiles it for that frame.
   */
  shaders?: ShaderProgramHandle[];

  /**
   * Extra source of ids whose committed paint should be suppressed during the current frame,
   * in addition to those reported by the tools' `previewIds()`. `<SceneCanvas>` wires it to
   * the gesture dispatcher's in-flight handles.
   */
  previewIdsExtra?: () => Iterable<string> | null;

  /**
   * Extra preview-pose lookup checked after the active tool's `previewPose` misses, so
   * selection chrome tracks the ghost during dispatcher-driven drags. Returns `null` /
   * `undefined` when no preview is in flight.
   */
  previewPoseExtra?: (id: string) => unknown;

  /**
   * In-flight gesture state `<Canvas>` can't see for itself. Backs the `getGestureBounds` /
   * `subscribeGestures` / `getGestureVersion` trio on `helpersRef`. Unwired, those three
   * report "no gesture in flight" and never fire.
   */
  gestureSource?: GestureSource;

  /**
   * Fill for the full canvas surface, drawn as a screen-space layer beneath every other
   * layer, the grid and anything anchored before it included — independent of pan / zoom.
   */
  backgroundFill?: Paint;

  /** Dev HUD: a fixed-position widget showing live cursor coords in both viewport (client)
   *  and canvas (world) frames. */
  cursorCoordsHud?: boolean;

  /** Dev HUD: a fixed-position widget listing the ids `pickEvery(world)` returns under the
   *  cursor. */
  pickHud?: boolean;

  /**
   * Dev HUD: a fixed-position widget reporting the active modality mode, the active-slot
   * tool, and the hotkey stack. `true` renders `—` for the mode line; pass an object to
   * supply the current mode id.
   */
  modalityHud?: boolean | { modeId?: string };

  /** Single-best hit resolver for the `pickHud` — the id this point would select on a bare
   *  click. When omitted the HUD skips the bold-best highlight. */
  pickBest?: (worldX: number, worldY: number) => string | null;


  /**
   * Mode-owned decoration layer (e.g. path-edit anchor dots). Composed as a `decorationLayer`
   * entry in `layers` with no anchor, which this prop replaces: it paints above every slot
   * and every other custom layer, and beneath a tool's `'top'` overlays. A tool's
   * selection-anchored overlays sit beneath it too while there is selection chrome to anchor
   * them; with that slot empty they fall to the tail and paint above it.
   */
  decorationLayer?: RenderLayer<unknown>;

  /**
   * Chrome-caps visibility resolver. Exposed on `helpersForLayers.getIsVisible` so custom
   * layers (notably `composeAffordanceLayer`) can gate paint by chrome id, and threaded into
   * hit-testing so the same gate applies there. Called fresh per draw / per hitTest. Omit to
   * leave every chrome element visible.
   */
  getIsVisible?: () => (id: string) => boolean;

  /**
   * Show or hide whole render layers by id. An id absent from the map falls
   * back to the layer's own `defaultVisible`, and a layer marked `alwaysOn`
   * ignores the map entirely.
   *
   * Hiding a layer also stops it claiming pointer events through
   * `hitTestExtras` — a layer nobody can see must not swallow a click.
   *
   * This is `getIsVisible`'s coarser sibling: that one gates individual
   * chrome elements *within* a layer, this one gates the layer.
   */
  layerVisibility?: Record<string, boolean>;

  /**
   * Draw order, by layer id, bottom first. Omit for the order the layers
   * arrive in.
   *
   * **A listed order is the whole list:** any layer whose id is missing from
   * it is not drawn. Reordering two layers means naming all of them.
   */
  layerOrder?: string[];

  /**
   * Runs of consecutive layers that composite as one — the surface for blurring the world
   * while the chrome above it stays sharp. Members are named by layer id. See
   * {@link LayerGroup}.
   */
  layerGroups?: readonly LayerGroup[];
}

export type {
  CanvasViewHelpers,
  CanvasSurfaceHelpers,
  CanvasHelpers,
} from './useViewHelpers';

function resolveToolsCursor(
  tools: ToolsApi,
  ctxBase?: () => Omit<ToolCtx, 'scratch'>,
): ResolvedCursor | undefined {
  const id = tools.hotkeyEngaged ?? tools.active;
  const tool = id === null ? undefined : tools.registry[id];
  if (!tool?.cursor) return undefined;
  if (typeof tool.cursor !== 'function') return resolveCursorTier(tool.cursor);
  if (!ctxBase) return undefined;
  // Function form. `ctx.scratch` is always null here: mid-gesture cursors are
  // `Action.activeCursor`, applied imperatively by the hover pump. A tool that wants a
  // cursor driven by its own state closes over its own ref.
  try {
    const base = ctxBase();
    return resolveCursorTier(tool.cursor({ ...base, scratch: null }));
  } catch {
    return undefined;
  }
}

/** Stable empty map, so an omitted `layerVisibility` doesn't remake the paint
 *  effect's deps every render. */
const NO_LAYER_VISIBILITY: Record<string, boolean> = {};

/** The origin a canvas-local point is measured from. */
const CANVAS_ORIGIN = { left: 0, top: 0 };

/** Client coords to world, through the `clientToWorld` prop when one is
 *  supplied and the canvas rect otherwise. Every pointer path in this file
 *  goes through here so the two cannot drift. */
function toWorld(
  canvas: HTMLElement,
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
    flattenTolerance,
    contentVersion,
    syncPaint = false,
    redrawOn,
    adapter,
    layers: layersMap,
    selection,
    boundsOf,
    boundsOfPose,
    pickEvery,
    clientToWorld,
    paintInto,
    inputElement,
    poseDescriptor: geometry = AUTO_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>,
    className,
    style,
    tabIndex = 0,
    onFocus,
    onBlur,
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
    backgroundFill,
    cursorCoordsHud,
    pickHud,
    modalityHud,
    pickBest,
    decorationLayer,
    getIsVisible,
    layerVisibility,
    layerOrder,
    layerGroups,
  } = props;

  const { sink: debugSink, overlay: debugOverlay, frameStats, getDebug } = useDebugSink(debugProp);

  // The element input comes from and every client→world conversion measures: the `<canvas>`
  // this component renders, or under `paintInto` the caller's `inputElement`.
  const canvasRef = useRef<HTMLElement | null>(null);
  // The `<canvas>` this component rendered, if it rendered one. `paint` is the
  // only thing that needs a real canvas, for `getContext`.
  const ownCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Stable, so a commit does not detach the element: an inline ref is nulled
  // until the layout phase reaches it, and a sync paint asked for before that
  // finds no canvas.
  const setOwnCanvas = useCallback((el: HTMLCanvasElement | null) => {
    ownCanvasRef.current = el;
    canvasRef.current = el;
  }, []);
  const detached = !!paintInto;
  // The detached input element reaches `canvasRef` at commit; the own canvas
  // arrives through `setOwnCanvas`, React's ref callback.
  useInsertionEffect(() => {
    if (detached) canvasRef.current = inputElement ?? null;
  });
  // Where pixels go. Split from `canvasRef` only when detached.
  const paintTarget = detached ? (paintInto.canvas ?? null) : null;
  const paintTargetRef = useLatest(paintTarget);
  const paintRect = detached ? { x: paintInto.x, y: paintInto.y } : null;
  const paintRectRef = useLatest(paintRect);

  // Read by `hitTestExtras`, which is built once and must see live values.
  const helpersForLayersRef = useRef<CanvasHelpers<TPose> | null>(null);
  const dimsRef = useLatest({ width, height });
  // Which layers reach the screen, and which chrome within them: asked by the
  // paint and by every hit-test.
  const gateRef = useLatest({ getIsVisible, layerVisibility, layerOrder });

  // React does not drive the paint; the frame loop does. The thunk defers to
  // `paint` below, which needs inputs this render has not computed yet.
  const paintRef = useRef<() => boolean>(() => false);
  const { lease, requestRedraw, subscribeFrame, subscribeBeforePaint, subscribeResume } = useCanvasSurface(
    useCallback(() => paintRef.current(), []),
    { syncPaint, target: canvasRef, dpr: dprProp, redrawOn, shaders },
  );

  const contentVersionRef = useLatest(contentVersion);
  const paintedVersionRef = useRef(0);
  const getPaintedVersion = useCallback(() => paintedVersionRef.current, []);

  // The `layersWithDebug` memo reads `extrasRef.current`, so registration has
  // to bump state to re-run it. Rare (a HUD attaching, a loupe mounting).
  const [extrasVersion, setExtrasVersion] = useState(0);
  const extrasRef = useRef<Set<RenderLayer<unknown>>>(new Set());
  const registerLayer = useCallback((layer: RenderLayer<unknown>) => {
    extrasRef.current.add(layer);
    setExtrasVersion(n => n + 1);
    return () => {
      extrasRef.current.delete(layer);
      setExtrasVersion(n => n + 1);
    };
  }, []);

  // Hit-test registered layers topmost-first: registration order is draw order, so the
  // last-registered layer gets first refusal. `<SceneCanvas>` folds this into its
  // `affordanceAt` thunk; Canvas has the layers but not the dispatcher.
  const hitTestExtrasIn = useCallback((
    worldX: number,
    worldY: number,
    view: View,
    dims: Dims,
    data: unknown,
    only?: readonly RenderLayer<unknown>[],
  ) => {
    const layers = [...extrasRef.current].reverse();
    const gate = gateRef.current;
    const isVisible = gate.getIsVisible?.() ?? alwaysVisible;
    const visibility = gate.layerVisibility ?? NO_LAYER_VISIBILITY;
    const order = gate.layerOrder;
    for (const layer of layers) {
      if (!layer.hitTest) continue;
      if (only && !only.includes(layer)) continue;
      if (!isLayerPainted(layer, visibility, order)) continue;
      const hit = layer.hitTest(worldX, worldY, data, view, dims, isVisible);
      if (hit) return { layerId: layer.id, hit };
    }
    return null;
  }, [gateRef]);

  const {
    viewRef, controlledView, setView, getView, subscribeView,
    adoptControlled, announceControlled, clearSubscribers,
  } = useCanvasView({
    view: viewProp, defaultView, onViewChange, viewBounds, dims: () => dimsRef.current, requestRedraw,
  });

  const hitTestExtras = useCallback((
    worldX: number,
    worldY: number,
    frame?: { view: View; dims: Dims },
  ) => hitTestExtrasIn(
    worldX,
    worldY,
    frame?.view ?? viewRef.current,
    frame?.dims ?? dimsRef.current,
    helpersForLayersRef.current,
  ), [hitTestExtrasIn, dimsRef, viewRef]);

  useLayoutEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    return registerMountedCanvas({ element, getView });
  }, [detached, inputElement, getView]);

  // The painted tier's channel. `<Canvas>` owns it because it owns both ends:
  // the tool cursor that feeds it and the frame loop that has to repaint when
  // it changes. The hover pump reaches it through the ref handle below.
  const paintedCursor = useMemo<PaintedCursorState>(() => createPaintedCursorState(), []);
  const paintedCursorLayer = useMemo(
    () => createPaintedCursorLayer(paintedCursor),
    [paintedCursor],
  );
  // An idle pointermove repaints nothing on its own, so a cursor the compositor
  // is not drawing needs its own pump. The store stays quiet unless something
  // painted is actually on screen.
  useEffect(() => paintedCursor.subscribe(() => { requestRedraw(); }), [paintedCursor, requestRedraw]);

  const getSurfaceRect = useCallback(() => {
    const origin = paintRectRef.current;
    const { width: w, height: h } = dimsRef.current;
    return { x: origin?.x ?? 0, y: origin?.y ?? 0, width: w, height: h };
  }, [dimsRef, paintRectRef]);

  useImperativeHandle(ref, () => ({
    // Named rather than read off `canvasRef` so the handle rebuilds when a
    // detached surface's input element arrives, which is a render later.
    element: detached ? inputElement ?? null : canvasRef.current,
    surface: detached ? paintInto?.canvas ?? null : ownCanvasRef.current,
    getSurfaceRect,
    requestRedraw,
    subscribeFrame,
    subscribeBeforePaint,
    subscribeResume,
    registerLayer,
    hitTestExtras,
    getView,
    setView,
    subscribeView,
    getPaintedVersion,
    paintedCursor,
    getDebug,
  }), [canvasRef, ownCanvasRef, detached, inputElement, paintInto?.canvas,
       getSurfaceRect, requestRedraw, subscribeFrame, subscribeBeforePaint, subscribeResume,
       registerLayer,
       hitTestExtras, getView, setView, subscribeView, getPaintedVersion,
       paintedCursor, getDebug]);

  const layerCacheRef = useRef<LayerCommandCache>(new Map());

  // Views registered on this surface — declared as `views` descriptors or
  // mounted as `<CanvasView>` children. Null outside a surface that mounts a
  // registry, which is the single-view case.
  const viewRegistry = useOptionalViewRegistry();

  // A noop adapter stands in when none is supplied.
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

  // Canvas owns no selection state. A no-op fallback keeps all downstream reads safe without
  // branching.
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

  // Base ctx for the function form of `Tool.cursor`. The cursor is resolved during render, so
  // the ctx carries this render's values; only `applyOps`, which a cursor function could call
  // later, reads a ref.
  const effectiveAdapterRef = useLatest(effectiveAdapter);
  const clientToWorldRef = useLatest(clientToWorld);
  const toolsCtxBase = () => {
    const view = controlledView ?? viewRef.current;
    const c = detached ? inputElement ?? null : canvasRef.current;
    const rect = c ? c.getBoundingClientRect() : (typeof DOMRect !== 'undefined' ? new DOMRect() : ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 } as DOMRect));
    return {
      worldX: 0,
      worldY: 0,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      selection: effectiveSelection,
      adapter: effectiveAdapter,
      applyOps: (ops: Op[], label: string) => {
        dispatchApplyBatch(effectiveAdapterRef.current, ops, label);
      },
      view,
      setView,
      canvasRect: rect,
      debug: debugSink ?? undefined,
    };
  };

  // Read the ref at call time so the HUDs don't reinstall their useEffect on every render
  // when the prop identity changes.
  const pickEveryRef = useLatest(pickEvery);
  const pickBestRef = useLatest(pickBest);
  const stablePickEveryForHud = useCallback(
    (wx: number, wy: number): readonly string[] => {
      const pe = pickEveryRef.current;
      if (!pe) return [];
      const raw = pe(wx, wy);
      if (!raw) return [];
      return Array.isArray(raw) ? raw : [raw];
    },
    [pickEveryRef],
  );
  const stablePickBestForHud = useCallback(
    (wx: number, wy: number): string | null => pickBestRef.current?.(wx, wy) ?? null,
    [pickBestRef],
  );
  const toWorldForHud = useCallback((clientX: number, clientY: number): [number, number] => {
    const el = canvasRef.current;
    if (!el) return [clientX, clientY];
    return toWorld(el, clientX, clientY, viewRef.current, clientToWorldRef.current);
  }, [clientToWorldRef, viewRef]);
  const selectedIdsForWiring = effectiveSelection.current;

  // One view's overlay-aware state. A hook, so N views are N components each
  // calling it once — not a loop in this body.
  const {
    helpers: viewHelpers,
    chromeState: viewChromeState,
    effectiveBoundsOf,
    previewExtraRef,
  } = useViewHelpers<TPose>({
    adapter,
    geometry,
    boundsOf,
    boundsOfPose,
    selection: selectedIdsForWiring,
    tools,
    gestureSource,
    previewPoseExtra,
    previewIdsExtra,
    getIsVisible: () => gateRef.current.getIsVisible?.() ?? alwaysVisible,
  });

  const surfaceHelpers: CanvasSurfaceHelpers = {
    getDebug: () => debugSink,
  };
  const helpersForLayers: CanvasHelpers<TPose> = { ...viewHelpers, ...surfaceHelpers, viewId: null };

  const backgroundLayer = useMemo(
    () => (backgroundFill ? createBackgroundFillLayer(backgroundFill) : undefined),
    [backgroundFill],
  );

  const sceneLayersKey = useSceneLayerList(adapter);
  const layers = useMemo<RenderLayer<unknown>[]>(() => {
    const standardLayers: Partial<
      Record<(typeof STANDARD_SLOTS)[number], RenderLayer<unknown>>
    > = {};

    const grid = layersMap.grid;
    if (isCustomEntry(grid)) standardLayers.grid = grid.layer;
    const cellHighlight = layersMap.cellHighlight;
    if (isCustomEntry(cellHighlight)) standardLayers.cellHighlight = cellHighlight.layer;

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
      standardLayers.selectionOverlay = createSelectionOverlayLayer<TPose>({
        ...cfg,
        // A consumer-supplied pose lookup still needs the configured geometry
        // to project with; without one the layer reads bounds off the chrome
        // state and never calls either.
        ...(cfg.poseById
          ? { getPose: cfg.poseById, poseDescriptor: cfg.poseDescriptor ?? geometry }
          : {}),
      });
    }

    const out: RenderLayer<unknown>[] = composeOrderedLayers(
      decorationLayer ? { ...layersMap, decorationLayer: { layer: decorationLayer } } : layersMap,
      standardLayers, sceneLayers, backgroundLayer,
    );
    if (tools) {
      placeToolOverlays(out, standardLayers.selectionOverlay, tools.getActiveOverlays);
    }
    return out;
    // `sceneLayersKey` stands for `adapter.getLayers()`, which `buildSceneLayers` reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layersMap, adapter, effectiveBoundsOf, debugSink, tools, backgroundLayer,
      decorationLayer, geometry, previewExtraRef, sceneLayersKey]);

  const viewRegistryVersion = useSyncExternalStore(
    useCallback((cb: () => void) => viewRegistry?.subscribe(cb) ?? (() => {}), [viewRegistry]),
    () => viewRegistry?.getVersion() ?? 0,
    () => 0,
  );

  // The stack a view paints through its own camera is this canvas's, before
  // the views themselves are folded in — otherwise a view would contain
  // itself. Published by reference and read at draw time.
  const surfaceLayersRef = useLatest<readonly RenderLayer<unknown>[]>(layers);
  useEffect(() => {
    return viewRegistry?.attachSurface({
      origin: () => {
        const c = canvasRef.current;
        if (!c) return { left: 0, top: 0 };
        const r = c.getBoundingClientRect();
        return { left: r.left, top: r.top };
      },
      view: () => viewRef.current,
      dims: () => dimsRef.current,
      layers: () => surfaceLayersRef.current,
      requestRedraw,
      chromeState: () => helpersForLayersRef.current!.getChromeState(),
      hitTestExtras: hitTestExtrasIn,
      claimsAbove: (x, y) => {
        const view = viewRef.current;
        const [worldX, worldY] = clientToWorldHelper(x, y, CANVAS_ORIGIN, view);
        return hitTestExtrasIn(worldX, worldY, view, dimsRef.current, helpersForLayersRef.current) !== null;
      },
    });
  }, [viewRegistry, canvasRef, requestRedraw, hitTestExtrasIn, dimsRef, surfaceLayersRef, viewRef]);

  const layersWithDebug = useMemo(() => {
    // Views paint through the surface's own stack, so they sit above it and
    // below both the debug overlay and externally-registered layers.
    const withViews = viewRegistry
      ? [...layers, ...viewRegistry.list().filter((r) => r.paint).map((r) => r.layer as RenderLayer<unknown>)]
      : layers;
    const base = debugOverlay ? [...withViews, debugOverlay] : withViews;
    // The cursor goes last: it is the one thing that is always in front of
    // everything, including a consumer's own registered layers.
    return [...base, ...extrasRef.current, paintedCursorLayer];
    // extrasVersion drives re-reads of extrasRef when layers are registered/detached;
    // viewRegistryVersion does the same for registered views.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, debugOverlay, extrasVersion, viewRegistry, viewRegistryVersion,
      paintedCursorLayer]);

  useEffect(() => {
    const redraw = (): void => { requestRedraw(); };
    const offs: (() => void)[] = [];
    for (const layer of layersWithDebug) if (layer.subscribe) offs.push(layer.subscribe(redraw));
    return () => { for (const off of offs) off(); };
  }, [layersWithDebug, requestRedraw]);

  const shaderIdKey = shaderKeyOf(shaders);

  // Everything the paint, hit-testing and the view registry read that a React
  // render owns. `useLatest` and the insertion effect below publish committed
  // renders only, ahead of every layout effect in the commit, any of which may
  // ask for a sync paint.
  const paintInputs = {
    layers: layersWithDebug, width, height, debugSink, frameStats,
    dpr: dprProp, layerGroups, shaders,
    flattenTolerance,
  };
  const paintInputsRef = useLatest(paintInputs);
  useInsertionEffect(() => {
    adoptControlled();
    helpersForLayersRef.current = helpersForLayers;
    if (helpersRef) helpersRef.current = helpersForLayers;
    if (debugSinkRef) debugSinkRef.current = debugSink;
  });
  useLayoutEffect(() => {
    announceControlled();
  });

  const paint = useCallback((): boolean => {
    const c = paintTargetRef.current ?? ownCanvasRef.current;
    if (!c) return false;
    const rect = paintRectRef.current;
    const {
      layers: paintLayers, width: w, height: h, debugSink: sink, frameStats: timed,
      dpr: dprIn,
      flattenTolerance: paintFlattenTolerance,
      layerGroups: groups, shaders: paintShaders,
    } = paintInputsRef.current;

    const debugFrame = beginDebugFrame(sink, timed, paintLayers);

    const renderer = lease.bind(c, { width: w, height: h, dpr: dprIn }, {
      tile: rect,
      flattenTolerance: paintFlattenTolerance,
      shaders: paintShaders,
    });
    // No WebGL2 (jsdom), or a context that is lost for now: nothing to paint.
    if (!renderer) return false;

    const view = viewRef.current;
    const { layerVisibility: vis, layerOrder: order } = gateRef.current;
    const spans = debugFrame?.time();
    const commands = drawLayers(
      paintLayers,
      helpersForLayersRef.current,
      vis ?? NO_LAYER_VISIBILITY,
      order,
      view,
      { width: w, height: h },
      layerCacheRef.current,
      undefined,
      groups,
      spans,
    );
    renderer.render(commands, viewToMat3(view), spans ? { spans } : undefined);
    debugFrame?.end(renderer.lastFrameStats());
    paintedVersionRef.current = contentVersionRef.current?.() ?? 0;
    return true;
  }, [contentVersionRef, gateRef, lease, paintInputsRef, paintRectRef, paintTargetRef, viewRef]);
  useInsertionEffect(() => {
    paintRef.current = paint;
  });

  // A tripwire, not a list of values this effect uses: every paint input that
  // arrives on a render must appear here, or changing it paints stale.
  // `viewChromeState` stands in for the whole overlay-aware set the layer
  // helpers expose — it re-memoizes on exactly the selection, bounds and
  // preview inputs they read. What moves between renders instead (a scene
  // write, a gesture pump, a late image decode) pushes its own redraw.
  // Layout, not passive, so a `syncPaint` surface lands its pixels in the same
  // commit as the DOM.
  useLayoutEffect(() => {
    requestRedraw();
  }, [layersWithDebug, width, height, viewProp, debugSink, dprProp, flattenTolerance,
      layerVisibility, layerOrder, layerGroups, shaderIdKey, syncPaint,
      viewChromeState, getIsVisible, paintTarget, paintRect?.x, paintRect?.y, requestRedraw]);

  useEffect(() => {
    const layerCache = layerCacheRef.current;
    return () => {
      layerCache.clear();
      clearSubscribers();
    };
  }, [clearSubscribers]);

  // Resolved during render, so it reads this render's view, not the ref's
  // last committed one.
  const toolsCursorTier = tools
    ? resolveToolsCursor(tools, toolsCtxBase)
    : undefined;
  // A painted tool cursor gets `none` here and the layer draws it instead.
  const toolsCursor =
    toolsCursorTier === undefined
      ? undefined
      : toolsCursorTier.kind === 'css'
        ? toolsCursorTier.css
        : 'none';
  const effectiveStyle: React.CSSProperties | undefined = toolsCursor
    ? { ...style, cursor: toolsCursor }
    : style;
  const toolsPainted: PaintedCursor | null =
    toolsCursorTier?.kind === 'painted' ? toolsCursorTier : null;
  // Keyed on the value, not the object: the tier is rebuilt every render, and
  // publishing from render would notify a repaint mid-render.
  const toolsPaintedKey = toolsPainted
    ? `${toolsPainted.glyph}|${toolsPainted.angle}|${toolsPainted.size}|${toolsPainted.worldRadius}`
    : '';
  useEffect(() => {
    paintedCursor.setBase(toolsPainted);
    // `toolsPainted` is a fresh object each render; the key is its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintedCursor, toolsPaintedKey]);

  useSurfaceInput(canvasRef, {
    focusOnPress: autoFocusOnPointerDown,
    onFocus,
    onBlur,
    onHover: (el, e) => {
      const view = viewRef.current;
      const [worldX, worldY] = toWorld(el, e.clientX, e.clientY, view, clientToWorld);
      const visibility = layerVisibility ?? NO_LAYER_VISIBILITY;
      // Same gate as `hitTestExtrasIn`: a layer nobody can see takes no input.
      for (const layer of layersWithDebug) {
        if (!layer.onUncapturedMove || !isLayerPainted(layer, visibility, layerOrder)) continue;
        layer.onUncapturedMove(worldX, worldY, e, view, { width, height });
      }
    },
    onLeave: () => {
      for (const layer of layersWithDebug) layer.onUncapturedLeave?.();
    },
  });

  // The cursor is a tool's, but under `paintInto` it has no element of ours to
  // sit on. Written imperatively rather than by the caller, so a tool's cursor
  // keeps working without the caller mirroring tool state.
  useEffect(() => {
    if (!detached || !inputElement) return;
    inputElement.style.cursor = toolsCursor ?? '';
  }, [detached, inputElement, toolsCursor]);

  const huds = (
    <>
      {cursorCoordsHud && (
        <CursorCoordsHud
          canvasRef={canvasRef}
          {...(detached ? { anchorRef: canvasRef } : {})}
          viewRef={viewRef}
          toWorld={toWorldForHud}
        />
      )}
      {pickHud && (
        <PickHud
          canvasRef={canvasRef}
          {...(detached ? { anchorRef: canvasRef } : {})}
          viewRef={viewRef}
          toWorld={toWorldForHud}
          pickEvery={stablePickEveryForHud}
          pickBest={stablePickBestForHud}
        />
      )}
      {modalityHud && (
        <ModalityHud
          canvasRef={canvasRef}
          {...(detached ? { anchorRef: canvasRef } : {})}
          modeId={typeof modalityHud === 'object' ? modalityHud.modeId : undefined}
        />
      )}
    </>
  );

  // Detached: no element of our own, but the HUDs are DOM and still belong to
  // this pane. Held until the input element arrives — `useHostAnchor` resolves
  // its host on mount and again only when the panel or the window moves, so a
  // HUD mounted against a null host would latch off.
  if (detached) return inputElement ? huds : null;

  return (
    <>
      <canvas
        ref={setOwnCanvas}
        width={width}
        height={height}
        tabIndex={tabIndex}
        className={className}
        style={effectiveStyle}
      />
      {huds}
    </>
  );
}

/** Forward-ref'd `<canvas>` wrapper. Generic over the object and pose types, inferred from
 *  the `adapter` prop. */
export const Canvas = forwardRef(CanvasInner) as <
  TNode extends { id: string } = { id: string },
  TPose = unknown,
>(
  props: CanvasProps<TNode, TPose> & { ref?: React.ForwardedRef<CanvasExtensionApi> },
) => ReturnType<typeof CanvasInner>;

