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
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { ToolsApi } from '../tools/useTools';
import type { ToolsDispatcher } from '../tools/dispatcher';
import type { ToolCtx } from '../tools/types';
import type { Op } from '../core/ops/types';
import { dispatchApplyBatch } from '../core/applyOps';
import type { NodeId } from '../core/scene/types';
import type { View } from '../core/viewport/view';
import { clampView } from '../core/viewport/clampView';
import { drawLayers, type RenderLayer } from '../core/layers/render';
import { WeaselRenderer, viewToMat3, type DrawCommand } from '@orochi235/weasel-gl';
import {
  useSelection,
  type SelectionApi,
  type UseSelectionOptions,
} from '../features/selection/useSelection';
import { useArrayAdapter, type UseArrayAdapterOptions } from '../core/adapters/useArrayAdapter';
import { useDelete } from '../interactions/actions/delete';
import { useNudge } from '../interactions/actions/nudge';
import { useDuplicate } from '../interactions/actions/duplicate';
import { useUndoRedo } from '../interactions/actions/undo-redo';
import type { UndoRedoAdapter } from '../interactions/actions/undo-redo';
import type {
  MoveAdapter,
  ResizeAdapter,
  RotateAdapter,
} from '../core/adapters/types';
import { createGridLayer, type GridLayerOpts } from '../features/grid/layer';
import {
  createCellHighlightLayer,
  type CellHighlightLayerOpts,
} from '../features/grid/cellHighlight';
import {
  createSelectionOverlayLayer,
  type SelectionOverlayLayerOpts,
} from '../features/selection/overlay';
import { AUTO_POSE_DESCRIPTOR } from '../interactions/gestures/resize/autoPoseDescriptor';
import type { PoseDescriptor } from '../interactions/gestures/resize/geometry';
import type { DebugConfig, DebugSink, DebugSnapshot } from '../debug/types';
import { parseDebugFlags } from '../debug/parseDebugFlags';
import { createDebugSink } from '../debug/createDebugSink';
import { createDebugOverlayLayer } from '../debug/createDebugOverlayLayer';
import { MULTI_RESIZE_TARGET_ID } from '../tools/builtin/useSelectTool';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** Standard slot names — render in this canonical order.
 *  `cellHighlight` is internal: emitted from the `grid` slot's nested
 *  `highlight` config, not a top-level layer key. */
export const STANDARD_SLOTS = [
  'grid',
  'cellHighlight',
  'scene',
  'selectionOverlay',
] as const;
/** Names of the slots `<Canvas>` supports out of the box (excluding the implicit cell-highlight overlay). */
export type StandardSlotName = Exclude<(typeof STANDARD_SLOTS)[number], 'cellHighlight'>;

/** Grid slot config — extends raw grid layer opts with an optional nested
 *  `highlight` sub-config. The cell-highlight layer is rendered immediately
 *  after the grid in the canonical stack. */
export type GridSlotConfig = GridLayerOpts & {
  /** Cell-highlight overlay; omit or set to `null` to skip. */
  highlight?: CellHighlightLayerOpts | null;
};

/** Scene slot config — describes how to draw one object with its effective pose. */
export interface SceneSlotConfig<TObject extends { id: string }, TPose> {
  /** Override `adapter.getObjects()` for the object iteration. */
  objects?: TObject[];
  /** Project an object to its committed pose. Defaults to `adapter.getPose(obj.id)`. */
  toPose?: (obj: TObject) => TPose;
  /** Draw a single object as a `DrawCommand` tree. */
  drawOne: (obj: TObject, pose: TPose, view: View) => DrawCommand[];
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

/** Custom layer entry — any key not in `STANDARD_SLOTS`. The presence of
 *  `.layer` discriminates this from a slot config. */
export interface CustomLayerEntry {
  layer: RenderLayer<unknown>;
  /** Insert immediately after the named standard slot. */
  after?: StandardSlotName;
  /** Insert immediately before the named standard slot. */
  before?: StandardSlotName;
}

/** Per-slot config union. The key narrows it in practice. */
export type StandardSlotConfig<TObject extends { id: string }, TPose> =
  | GridSlotConfig
  | SceneSlotConfig<TObject, TPose>
  | SelectionOverlaySlotConfig<TPose>;

export type LayerSlotValue<TObject extends { id: string }, TPose> =
  | StandardSlotConfig<TObject, TPose>
  | CustomLayerEntry
  | null;

export type LayersMap<TObject extends { id: string }, TPose> = {
  grid?: GridSlotConfig | null;
  scene?: SceneSlotConfig<TObject, TPose> | null;
  selectionOverlay?: SelectionOverlaySlotConfig<TPose> | null;
} & {
  [customKey: string]: LayerSlotValue<TObject, TPose> | undefined;
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
export interface CanvasProps<TObject extends { id: string } = { id: string }, TPose = unknown> {
  /** CSS-pixel width. */
  width: number;
  /** CSS-pixel height. */
  height: number;

  /** Combined adapter. Required for the scene slot, default pickEvery/boundsOf,
   *  and the internal move/resize/rotate controllers. Optional for trivial
   *  canvases. Mutually exclusive with `items` — pass one or the other.
   *  Insert and area-select live entirely in `useInsertTool` / `useSelectTool`
   *  now; pass those via `tools={useTools(...)}` instead. */
  adapter?: MoveAdapter<TObject, TPose>
    & ResizeAdapter<TObject, TPose>
    & RotateAdapter<TObject, TPose>;

  /** Inline scene wiring: when `adapter` is omitted and `items`/`setItems`
   *  are provided, Canvas synthesizes an `arrayAdapter` internally (via
   *  `useArrayAdapter`). `toPose` defaults to identity (the item *is* the
   *  pose) — supply it only when the pose is a sub-shape of the item.
   *  Use the explicit `adapter` prop instead for groups, custom history,
   *  or non-array scenes.
   *  @deprecated Use `useScene({ items })` + `<SceneCanvas>` instead. The
   *  inline-items props will be removed in a follow-up. */
  items?: TObject[];
  /** @deprecated Use `useScene({ items })` + `<SceneCanvas>`. */
  setItems?: UseArrayAdapterOptions<TObject, TPose>['setItems'];
  /** @deprecated Use `useScene({ items })` + `<SceneCanvas>`. */
  toPose?: UseArrayAdapterOptions<TObject, TPose>['toPose'];
  /** @deprecated Use `useScene({ items })` + `<SceneCanvas>`. */
  fromPose?: UseArrayAdapterOptions<TObject, TPose>['fromPose'];
  /** @deprecated Use `useScene({ items })` + `<SceneCanvas>`. */
  createDefault?: UseArrayAdapterOptions<TObject, TPose>['createDefault'];
  /** @deprecated Use `useScene({ items })` + `<SceneCanvas>`. */
  poseBounds?: UseArrayAdapterOptions<TObject, TPose>['poseBounds'];
  /** @deprecated Use `useScene({ items })` + `<SceneCanvas>`. */
  intersectsRect?: UseArrayAdapterOptions<TObject, TPose>['intersectsRect'];

  /** Selection semantics. See {@link CanvasSelectionMode}. Default `'single'`. */
  selectionMode?: CanvasSelectionMode;

  /** Layer map. See module docstring for slot semantics. */
  layers: LayersMap<TObject, TPose>;

  // --- Internal hook configuration ---
  selection?: SelectionApi;
  selectionOptions?: UseSelectionOptions;

  /** Pose↔bounds projection. When supplied, drives default `pickEvery`,
   *  `boundsOf`, and the selection-overlay bounds source so non-rect TPose
   *  (e.g. `Path`) doesn't require per-prop overrides. Defaults to the rect
   *  identity. */
  geometry?: PoseDescriptor<TPose>;

  // --- Gesture overrides (escape hatches for non-rect / group-aware apps) ---
  pickEvery?: (worldX: number, worldY: number) => string | string[] | null;
  boundsOf?: (id: string) => Bounds | null;
  clientToWorld?: (canvas: HTMLCanvasElement, cx: number, cy: number) => [number, number];

  // --- Per-event overrides — replace the auto-built handler entirely ---
  onPointerDown?: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerMove?: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerUp?: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLCanvasElement>;

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
   *  through `tools.dispatcher`. The action-gesture hooks (delete / nudge /
   *  undoRedo / duplicate) continue to wire from `gestures` as-is; they'll
   *  move to always-on tools in a follow-up. */
  tools?: import('../tools/useTools').ToolsApi;
  gestures?: GesturesConfig<TPose>;

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
}

/** Per-action config for the `gestures` prop. */
export interface DeleteGestureConfig {
  label?: string;
  filter?: (ids: NodeId[]) => NodeId[];
}
export interface NudgeGestureConfig<TPose> {
  step?: number;
  shiftStep?: number;
  label?: string;
  /** Override pose translation. Defaults to `geometry.translate` if available,
   *  else the rect-pose translator. */
  translatePose?: (pose: TPose, dx: number, dy: number) => TPose;
}
export interface DuplicateGestureConfig {
  cloneObject: (id: NodeId, offset: { dx: number; dy: number }) => { id: NodeId };
  offset?: { dx: number; dy: number };
  label?: string;
}
export interface UndoRedoGestureConfig {
  /** Source of the undo/redo stack — typically a `Scene` or `History`. */
  adapter: UndoRedoAdapter;
}

export interface GesturesConfig<TPose> {
  /** Bind Delete/Backspace to remove the current selection. */
  delete?: boolean | DeleteGestureConfig;
  /** Bind arrow keys to translate the current selection (shift = larger step). */
  nudge?: boolean | NudgeGestureConfig<TPose>;
  /** Bind Mod+D to duplicate the current selection. Requires `cloneObject` so
   *  always an object — there's no useful default for "what is a copy of X". */
  duplicate?: DuplicateGestureConfig;
  /** Bind Mod+Z / Mod+Shift+Z to undo/redo against the supplied adapter. */
  undoRedo?: UndoRedoGestureConfig;
}

/** Live overlay-aware lookups exposed to custom layers via `helpersRef`. */
export interface CanvasHelpers<TPose> {
  /** Pose currently displayed for `id` — drag/resize/rotate overlay if active,
   *  otherwise the committed pose from the adapter. Returns `null` if the id
   *  isn't known. */
  getEffectivePose(id: string): TPose | null;
  /** Overlay-aware bounds for `id`. */
  getEffectiveBounds(id: string): Bounds | null;
}

const STANDARD_SLOT_SET = new Set<string>(STANDARD_SLOTS);

// Stable identities for the always-on useArrayAdapter call when the consumer
// is on the explicit-`adapter` path (synthesized adapter is unused, but the
// hook still runs).
const EMPTY_ITEMS: { id: string }[] = [];
const NOOP_SET_ITEMS = () => {};
// Default `toPose` when omitted on the inline-items path: the item *is* the
// pose. Works for the common case where TObject already carries pose fields
// (e.g. `{ id, x, y, width, height, ... }`); supply an explicit `toPose`
// when the pose is a sub-shape of the item or computed.
const IDENTITY_TO_POSE = (obj: unknown) => obj as unknown;

function isCustomEntry(v: unknown): v is CustomLayerEntry {
  return !!v && typeof v === 'object' && 'layer' in (v as Record<string, unknown>);
}

/**
 * Build the scene layer. Tool ghosts (in-flight drag/resize/rotate poses) are
 * published via the active tool's `previewPose`/`previewIds` and rendered on
 * top of this layer (see SceneCanvas's preview-ghost layer); we draw committed
 * poses here, and `hideIds()` lets us skip the committed paint of ids the
 * active tool is currently ghosting so the source doesn't show through.
 */
function buildSceneLayer<TObject extends { id: string }, TPose>(
  cfg: SceneSlotConfig<TObject, TPose>,
  adapter:
    | (MoveAdapter<TObject, TPose> & ResizeAdapter<TObject, TPose> & RotateAdapter<TObject, TPose>)
    | undefined,
  debugSink: DebugSink | null,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
  hideIds: () => Set<string> | null,
): RenderLayer<unknown> {
  const toPose =
    cfg.toPose ??
    ((obj: TObject) => (adapter ? adapter.getPose(obj.id) : (obj as unknown as TPose)));
  const drawOne = cfg.drawOne;
  return {
    id: 'scene',
    label: 'Scene',
    draw: (_data, view) => {
      const objects = cfg.objects ?? adapter?.getObjects() ?? [];
      const hidden = hideIds();
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
      if (children.length === 0) return [];
      return [{ kind: 'group', transform: viewToMat3(view), children }];
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

function CanvasInner<TObject extends { id: string }, TPose>(
  props: CanvasProps<TObject, TPose>,
  ref: React.ForwardedRef<HTMLCanvasElement>,
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
    clientToWorld,
    geometry = AUTO_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>,
    onPointerDown: onPointerDownOverride,
    onPointerMove: onPointerMoveOverride,
    onPointerUp: onPointerUpOverride,
    onPointerCancel: onPointerCancelOverride,
    background,
    className,
    style,
    tabIndex = 0,
    autoFocusOnPointerDown = true,
    helpersRef,
    gestures,
    tools,
    view: viewProp,
    defaultView,
    onViewChange,
    viewBounds,
    items,
    setItems,
    toPose,
    fromPose,
    createDefault,
    poseBounds,
    intersectsRect,
    debug: debugProp,
    debugSinkRef,
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

  // Synthesized arrayAdapter when `adapter` is omitted but `items`/`setItems`/
  // `toPose` are supplied. The hook always runs (rules of hooks) — when the
  // user is on the explicit-`adapter` path, we feed it stub args and ignore
  // the result.
  const synthesizedAdapter = useArrayAdapter<TObject, TPose>({
    items: items ?? (EMPTY_ITEMS as TObject[]),
    setItems: setItems ?? NOOP_SET_ITEMS,
    toPose: toPose ?? (IDENTITY_TO_POSE as (obj: TObject) => TPose),
    fromPose,
    createDefault,
    poseBounds,
    intersectsRect,
  });
  const inlineSceneSupplied =
    adapterProp === undefined && items !== undefined && setItems !== undefined;
  const adapter = adapterProp ?? (inlineSceneSupplied ? synthesizedAdapter : undefined);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement, []);

  // GL renderer (lazy-instantiated on first paint).
  const glRendererRef = useRef<WeaselRenderer | null>(null);
  const lastResizeRef = useRef<{ w: number; h: number; dpr: number } | null>(null);

  // Viewport state: hybrid uncontrolled/controlled. When `viewProp` is
  // supplied we are controlled (consumer owns state). Otherwise we keep
  // internal state seeded from `defaultView`. `setView` always fires
  // `onViewChange` so consumers can persist regardless of mode.
  const [internalView, setInternalView] = useState<View>(defaultView ?? { x: 0, y: 0, scale: 1 });
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

  // Internal hooks always run (rules of hooks). They consult a noop adapter
  // when none is supplied; their controllers are then unused because the
  // gesture wiring below only enables move/resize when `adapter` is present.
  const noopAdapter = useMemo(
    () =>
      ({
        getPose: () => ({}) as TPose,
        getObjects: () => [],
      }) as unknown as MoveAdapter<TObject, TPose>
        & ResizeAdapter<TObject, TPose>
        & RotateAdapter<TObject, TPose>,
    [],
  );
  const effectiveAdapter = (adapter ?? noopAdapter) as MoveAdapter<TObject, TPose>
    & ResizeAdapter<TObject, TPose>
    & RotateAdapter<TObject, TPose>;

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
          worldX = (cx - rect.left) / view.scale + view.x;
          worldY = (cy - rect.top) / view.scale + view.y;
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
        applyBatch: (ops: Op[], label: string) => {
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
  // handlers see the live selection/adapter/applyBatch — useTools's own
  // default ctx is the empty test stub.
  useEffect(() => {
    if (!tools) return;
    // Small monkey-patch: replace the dispatcher's getCtx by re-creating it.
    // Phase 2 cleanup: thread getCtx through useTools properly so this isn't needed.
    const d = tools.dispatcher as ToolsDispatcher & { __setGetCtx?: (fn: (overrides?: { clientX?: number; clientY?: number; modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean } }) => unknown) => void };
    d.__setGetCtx?.(toolsCtxBase);
  }, [tools, toolsCtxBase]);

  // selRef tracks the live effective selection for the action-gesture hooks
  // (delete / nudge / duplicate) which read it through getSelection callbacks.
  const selRef = useRef<SelectionApi>(effectiveSelection);
  selRef.current = effectiveSelection;

  // Action gestures (Delete/Backspace, arrow nudge, Mod+D duplicate). Hooks
  // always run; each `bindKeyboard`/`enableKeyboard` flag gates whether the
  // underlying useKeybinding actually attaches a listener.
  const deleteCfg = gestures?.delete;
  const deleteEnabled = !!deleteCfg;
  const deleteOpts = (typeof deleteCfg === 'object' ? deleteCfg : {}) as DeleteGestureConfig;
  const adapterWithRemove = effectiveAdapter as typeof effectiveAdapter & {
    removeObject?: (id: string) => void;
  };
  useDelete(
    {
      getSelection: () => selRef.current.get(),
      getObject: (id) => effectiveAdapter.getObject?.(id) ?? { id },
      setSelection: (ids) => selRef.current.set(ids),
      removeObject: adapterWithRemove.removeObject,
      applyBatch: effectiveAdapter.applyBatch?.bind(effectiveAdapter),
    },
    { bindKeyboard: deleteEnabled && !tools?.has('delete'), label: deleteOpts.label, filter: deleteOpts.filter },
  );

  const nudgeCfg = gestures?.nudge;
  const nudgeEnabled = !!nudgeCfg;
  const nudgeOpts = (typeof nudgeCfg === 'object' ? nudgeCfg : {}) as NudgeGestureConfig<TPose>;
  useNudge<TPose>(
    {
      getSelection: () => selRef.current.get(),
      getPose: (id) => effectiveAdapter.getPose(id),
      applyBatch: effectiveAdapter.applyBatch?.bind(effectiveAdapter),
    },
    {
      enableKeyboard: nudgeEnabled && !tools?.has('nudge'),
      step: nudgeOpts.step,
      shiftStep: nudgeOpts.shiftStep,
      label: nudgeOpts.label,
      translatePose: nudgeOpts.translatePose ?? geometry.translate,
    },
  );

  const undoRedoCfg = gestures?.undoRedo;
  const undoRedoAdapter = useMemo<UndoRedoAdapter>(
    () => undoRedoCfg?.adapter ?? { undo: () => {}, redo: () => {}, canUndo: () => false, canRedo: () => false },
    [undoRedoCfg?.adapter],
  );
  useUndoRedo(undoRedoAdapter, { bindKeyboard: !!undoRedoCfg && !tools?.has('undoRedo') });

  const dupeCfg = gestures?.duplicate;
  useDuplicate<TPose>(
    {
      getSelection: () => selRef.current.get(),
      getPose: (id) => effectiveAdapter.getPose(id),
      cloneObject: dupeCfg?.cloneObject ?? ((id) => ({ id })),
      applyBatch: effectiveAdapter.applyBatch?.bind(effectiveAdapter),
    },
    {
      enableKeyboard: !!dupeCfg && !tools?.has('duplicate'),
      offset: dupeCfg?.offset,
      label: dupeCfg?.label,
    },
  );

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

  // boundsOf: pass-through for real ids. The synthetic multi-selection id is
  // resolved by the active tool's `previewBounds` (see `useSelectTool`'s
  // `MULTI_RESIZE_TARGET_ID` branch) — Canvas no longer special-cases it
  // inline. For overlays that read bounds outside a tool gesture, the
  // selection-overlay path below routes through `previewToolBounds` which surfaces
  // the tool's union synthesis.
  const effectiveBoundsOf = useMemo(() => {
    return boundsOf ?? baseBoundsOf;
  }, [boundsOf, baseBoundsOf]);

  // helpersForLayers: overlay-aware lookups passed to every RenderLayer.draw
  // call (as the `data` arg) so custom layers can read live overlay state
  // directly from their draw closure. The legacy `helpersRef` prop still
  // mirrors the same value for back-compat. The active Tool's `previewPose`/
  // `previewBounds` is the only overlay source post-cleanup; falls through to
  // the committed adapter pose / bounds when no tool is mid-gesture.
  const previewToolPose = (id: string): TPose | null => {
    if (!tools) return null;
    const tool = tools.registry[tools.hotkeyEngaged ?? tools.active];
    const p = tool?.previewPose?.(id);
    return (p ?? null) as TPose | null;
  };
  const previewToolBounds = (id: string): Bounds | null => {
    if (!tools) return null;
    const tool = tools.registry[tools.hotkeyEngaged ?? tools.active];
    const b = tool?.previewBounds?.(id);
    if (b) return b;
    const p = tool?.previewPose?.(id);
    return p == null ? null : geometry.getBounds(p as TPose);
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

  const handlePointerDown =
    onPointerDownOverride ??
    (tools
      ? (e: React.PointerEvent<HTMLCanvasElement>) => {
          if (autoFocusOnPointerDown) e.currentTarget.focus();
          tools.dispatcher.onPointerDown(e.nativeEvent);
          // Only attach if the dispatcher actually started a gesture; otherwise
          // we'd leak a listener for every empty click on the canvas.
          if (tools.dispatcher.hasActiveGesture()) attachDocListeners(tools.dispatcher);
        }
      : undefined);
  const handlePointerMove = onPointerMoveOverride ??
    (tools
      ? (e: React.PointerEvent<HTMLCanvasElement>) => tools.dispatcher.onPointerMove(e.nativeEvent)
      : undefined);
  const handlePointerUp = onPointerUpOverride ??
    (tools
      ? (e: React.PointerEvent<HTMLCanvasElement>) => {
          tools.dispatcher.onPointerUp(e.nativeEvent);
          // The doc-listener up handler also detaches; this branch covers the
          // common case where the release lands on the canvas itself.
          detachDocListeners();
        }
      : undefined);
  const handlePointerCancel = onPointerCancelOverride ?? undefined;
  const handleWheel = tools
    ? (e: React.WheelEvent<HTMLCanvasElement>) => tools.dispatcher.onWheel(e.nativeEvent)
    : undefined;

  const selectedIds = effectiveSelection.current;

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

    const sceneCfg = layersMap.scene as SceneSlotConfig<TObject, TPose> | null | undefined;
    if (
      sceneCfg &&
      !isCustomEntry(sceneCfg) &&
      (sceneCfg as SceneSlotConfig<TObject, TPose>).drawOne
    ) {
      standardLayers.scene = buildSceneLayer<TObject, TPose>(
        sceneCfg,
        adapter,
        debugSink,
        effectiveBoundsOf,
        () => {
          if (!tools) return null;
          const t = tools.registry[tools.hotkeyEngaged ?? tools.active];
          const ids = t?.previewIds?.();
          if (!ids) return null;
          return ids instanceof Set ? ids : new Set(ids);
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
      standardLayers.selectionOverlay = createSelectionOverlayLayer<TPose>({
        ...cfg,
        getSelection,
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

    const afterMap = new Map<string, RenderLayer<unknown>[]>();
    const beforeMap = new Map<string, RenderLayer<unknown>[]>();
    const tail: RenderLayer<unknown>[] = [];

    for (const [key, value] of Object.entries(layersMap)) {
      if (STANDARD_SLOT_SET.has(key)) continue;
      if (!isCustomEntry(value)) continue;
      if (value.after) {
        const arr = afterMap.get(value.after) ?? [];
        arr.push(value.layer);
        afterMap.set(value.after, arr);
      } else if (value.before) {
        const arr = beforeMap.get(value.before) ?? [];
        arr.push(value.layer);
        beforeMap.set(value.before, arr);
      } else {
        tail.push(value.layer);
      }
    }

    const out: RenderLayer<unknown>[] = [];
    for (const slot of STANDARD_SLOTS) {
      const before = beforeMap.get(slot);
      if (before) out.push(...before);
      const layer = standardLayers[slot];
      if (layer) out.push(layer);
      const after = afterMap.get(slot);
      if (after) out.push(...after);
    }
    out.push(...tail);
    if (tools) {
      out.push(...tools.getActiveOverlays());
    }
    return out;
  }, [layersMap, adapter, selectedIds, effectiveBoundsOf, multiActive, debugSink, tools]);

  // Append the debug overlay layer at the very top of the stack when debug
  // is enabled. The layer reads from `debugSink.snapshot()` and paints in
  // screen space.
  const layersWithDebug = useMemo(() => {
    if (!debugSink || !resolvedDebugConfig) return layers;
    return [
      ...layers,
      createDebugOverlayLayer({ sink: debugSink, config: resolvedDebugConfig }),
    ];
  }, [layers, debugSink, resolvedDebugConfig]);

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
  }, [layersWithDebug, width, height, background, effectiveView, debugSink]);

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
      onWheel={handleWheel}
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
  TObject extends { id: string } = { id: string },
  TPose = TObject,
>(
  props: CanvasProps<TObject, TPose> & { ref?: React.ForwardedRef<HTMLCanvasElement> },
) => ReturnType<typeof CanvasInner>;
