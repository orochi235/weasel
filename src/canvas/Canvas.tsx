/**
 * Top-level `<Canvas>` component that wraps a single `<canvas>` element with:
 *   - DPR setup (`setupCanvasDpr`)
 *   - clear-rect + optional background fill on every render
 *   - layer-stack composition from a map of named slots + custom layers
 *   - internal `useMove` / `useResize` / `useSelection` (overridable)
 *   - `usePointerGestures` wiring with auto-derived hitBody/boundsOf
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
import type { View } from '../features/viewport/view';
import { clampView } from '../features/viewport/clampView';
import { runLayers, type RenderLayer } from '../core/layers/render';
import { setupCanvasDpr } from '../features/viewport/pixelDensity';
import {
  usePointerGestures,
  type PointerGestureCallbackCtx,
} from '../interactions/usePointerGestures';
import {
  useSelection,
  type SelectionApi,
  type UseSelectionOptions,
} from '../features/selection/useSelection';
import { pickTopMostHit } from '../tools/builtin/pickTopMostHit';
import { useArrayAdapter, type UseArrayAdapterOptions } from '../core/adapters/useArrayAdapter';
import { useDelete } from '../interactions/actions/delete';
import { useNudge } from '../interactions/actions/nudge';
import { useDuplicate } from '../interactions/actions/duplicate';
import { useUndoRedo } from '../interactions/actions/undo-redo';
import type { UndoRedoAdapter } from '../interactions/actions/undo-redo';
import { useEditAnchors } from '../interactions/gestures/edit-anchors/editAnchors';
import type {
  EditAnchorsAdapter,
  EditAnchorsController,
  UseEditAnchorsOptions,
} from '../interactions/gestures/edit-anchors/editAnchors';
import {
  createAnchorEditOverlayLayer,
  type AnchorEditOverlayOpts,
} from '../interactions/gestures/edit-anchors/overlay';
import type { Path } from '../features/paths/types';
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
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../interactions/gestures/resize/geometry';
import { pathPoseDescriptor } from '../features/paths/poseDescriptor';
import type { DebugConfig, DebugSink, DebugSnapshot } from '../debug/types';
import { parseDebugFlags } from '../debug/parseDebugFlags';
import { createDebugSink } from '../debug/createDebugSink';
import { createDebugOverlayLayer } from '../debug/createDebugOverlayLayer';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Standard slot names — render in this canonical order.
 *  `cellHighlight` is internal: emitted from the `grid` slot's nested
 *  `highlight` config, not a top-level layer key. */
export const STANDARD_SLOTS = [
  'grid',
  'cellHighlight',
  'scene',
  'selectionOverlay',
  'anchorEditOverlay',
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
  /** Draw a single object given its effective pose. */
  drawOne: (ctx: CanvasRenderingContext2D, obj: TObject, pose: TPose, view: View) => void;
  /** Default ghost alpha for the move-overlay slot. Default 0.85. */
  ghostAlpha?: number;
}

/** Anchor-edit-overlay slot config — visual options for anchor + control circles. */
export type AnchorEditOverlaySlotConfig = Omit<AnchorEditOverlayOpts, 'getOverlay'>;

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
  | SelectionOverlaySlotConfig<TPose>
  | AnchorEditOverlaySlotConfig;

export type LayerSlotValue<TObject extends { id: string }, TPose> =
  | StandardSlotConfig<TObject, TPose>
  | CustomLayerEntry
  | null;

export type LayersMap<TObject extends { id: string }, TPose> = {
  grid?: GridSlotConfig | null;
  scene?: SceneSlotConfig<TObject, TPose> | null;
  selectionOverlay?: SelectionOverlaySlotConfig<TPose> | null;
  anchorEditOverlay?: AnchorEditOverlaySlotConfig | null;
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
 *     `onBodyHit` and `onTapEmpty` still fire so consumers can do their own
 *     picking.
 *
 * Escape hatches still apply: explicit `selection`, `hitBody`, `boundsOf`,
 * `resizeTarget`, `onBodyHit`, `onTapEmpty`, or `selectionOptions.mode`
 * override the `selectionMode`-derived defaults.
 */
export type CanvasSelectionMode = 'single' | 'multi' | 'none';

const MULTI_RESIZE_TARGET_ID = '__weasel:multi-selection';

/** Props for the top-level `<Canvas>` component — combines viewport, scene, gesture controllers, and slot overrides. */
export interface CanvasProps<TObject extends { id: string } = { id: string }, TPose = unknown> {
  /** CSS-pixel width. */
  width: number;
  /** CSS-pixel height. */
  height: number;

  /** Combined adapter. Required for the scene slot, default hitBody/boundsOf,
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
  /** Wire anchor-edit mode. `true` enables defaults; an object overrides
   *  options. When wired, double-clicking a polygon-shaped object enters
   *  edit mode (anchor circles + control handles), and Esc exits. */
  editAnchors?: boolean | UseEditAnchorsOptions;
  /** Override the editAnchors controller (rare). */
  editAnchorsController?: EditAnchorsController<TObject>;
  selection?: SelectionApi;
  selectionOptions?: UseSelectionOptions;

  /** Pose↔bounds projection. When supplied, drives default `hitBody`,
   *  `boundsOf`, and the selection-overlay bounds source so non-rect TPose
   *  (e.g. `Path`) doesn't require per-prop overrides. Defaults to the rect
   *  identity. */
  geometry?: PoseDescriptor<TPose>;

  // --- Gesture overrides (escape hatches for non-rect / group-aware apps) ---
  hitBody?: (worldX: number, worldY: number) => string | string[] | null;
  resizeTarget?: () => { id: string; bounds: Bounds } | null;
  rotateTarget?: () => { id: string; bounds: Bounds; rotation?: number } | null;
  /** World-pixel distance from the top edge of the bounding box to the
   *  rotation handle's center. Defaults to the kit's default. */
  rotationHandleDistance?: number;
  boundsOf?: (id: string) => Bounds | null;
  onBodyHit?: (ids: string[], ctx: PointerGestureCallbackCtx) => void;
  onTapEmpty?: (ctx: PointerGestureCallbackCtx) => void;
  clientToWorld?: (canvas: HTMLCanvasElement, cx: number, cy: number) => [number, number];
  handleHitRadius?: number;

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
  /** Tool primitive substrate. When supplied, pointer/keyboard/wheel events
   *  are routed through `tools.dispatcher` instead of the legacy
   *  `usePointerGestures` bindings. The action-gesture hooks (delete /
   *  nudge / undoRedo / duplicate) continue to wire from `gestures` as-is
   *  in Phase 1; they'll move to always-on tools in Phase 2. */
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
  filter?: (ids: string[]) => string[];
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
  cloneObject: (id: string, offset: { dx: number; dy: number }) => { id: string };
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

// Per-call dispatch: if the pose looks like a Path (`{ kind: 'polygon' | 'rect' }`)
// route to pathPoseDescriptor; otherwise treat as a plain rect pose. Avoids
// forcing demos with Path TPose to wire `geometry={pathPoseDescriptor}`
// explicitly.
const AUTO_POSE_DESCRIPTOR: PoseDescriptor<unknown> = {
  getBounds: (p) => isPathLike(p)
    ? pathPoseDescriptor.getBounds(p)
    : RECT_POSE_DESCRIPTOR.getBounds(p as { x: number; y: number; width: number; height: number }),
  remapBounds: (p, src, dst) => isPathLike(p)
    ? pathPoseDescriptor.remapBounds(p, src, dst)
    : RECT_POSE_DESCRIPTOR.remapBounds(p as { x: number; y: number; width: number; height: number }, src, dst),
  translate: (p, dx, dy) => isPathLike(p)
    ? pathPoseDescriptor.translate!(p, dx, dy)
    : RECT_POSE_DESCRIPTOR.translate!(p as { x: number; y: number; width: number; height: number }, dx, dy),
  intersectsRect: (p, rect) => isPathLike(p)
    ? pathPoseDescriptor.intersectsRect!(p, rect)
    : RECT_POSE_DESCRIPTOR.intersectsRect!(p as { x: number; y: number; width: number; height: number }, rect),
};

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

function aabbContains(b: Bounds, x: number, y: number): boolean {
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}

function isPathLike(p: unknown): p is Path {
  return !!p && typeof p === 'object' && 'kind' in p
    && ((p as { kind: unknown }).kind === 'polygon' || (p as { kind: unknown }).kind === 'rect');
}

function isCustomEntry(v: unknown): v is CustomLayerEntry {
  return !!v && typeof v === 'object' && 'layer' in (v as Record<string, unknown>);
}

/**
 * Build the scene layer. Tool ghosts (in-flight drag/resize/rotate poses) are
 * published via the overlay channel and rendered on top of this layer; we
 * draw committed poses here, and rely on the active tool's `peekPose` to
 * suppress the committed paint of ids it's currently ghosting via `hideIds`.
 */
function buildSceneLayer<TObject extends { id: string }, TPose>(
  cfg: SceneSlotConfig<TObject, TPose>,
  adapter:
    | (MoveAdapter<TObject, TPose> & ResizeAdapter<TObject, TPose> & RotateAdapter<TObject, TPose>)
    | undefined,
  debugSink: DebugSink | null,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
  peekPose: ((id: string) => TPose | null) | null,
  peekHide: (() => Iterable<string> | null) | null,
): RenderLayer<unknown> {
  const toPose =
    cfg.toPose ??
    ((obj: TObject) => (adapter ? adapter.getPose(obj.id) : (obj as unknown as TPose)));
  return {
    id: 'scene',
    label: 'Scene',
    draw: (ctx, _data, view) => {
      const objects = cfg.objects ?? adapter?.getObjects() ?? [];
      const hideIter = peekHide?.() ?? null;
      const hide = hideIter ? new Set(hideIter) : null;
      for (const obj of objects) {
        const overlayPose = peekPose ? peekPose(obj.id) : null;
        if (hide && hide.has(obj.id) && overlayPose == null) continue;
        const pose: TPose = overlayPose ?? toPose(obj);
        cfg.drawOne(ctx, obj, pose, view);
        if (debugSink) {
          const b = boundsOfFn ? boundsOfFn(obj.id) : null;
          if (b) debugSink.recordBounds(obj.id, { x: b.x, y: b.y, width: b.width, height: b.height });
          const ox = (pose as { x?: number }).x ?? (b ? b.x : 0);
          const oy = (pose as { y?: number }).y ?? (b ? b.y : 0);
          debugSink.recordOrigin(obj.id, { x: ox, y: oy });
        }
      }
    },
  };
}

function resolveToolsCursor(
  tools: ToolsApi,
  ctxBase?: () => Omit<ToolCtx, 'scratch'>,
): string | undefined {
  const id = tools.modifierEngaged ?? tools.active;
  const tool = tools.registry[id];
  if (!tool?.cursor) return undefined;
  if (typeof tool.cursor === 'string') return tool.cursor;
  if (!ctxBase) return undefined;
  // Function form: invoke at render time with the live base ctx and the
  // dispatcher's current scratch (if a gesture is in flight). Render-time
  // evaluation means cursor only re-resolves when the component re-renders —
  // scratch mutations inside the dispatcher don't trigger React updates on
  // their own. tools.modifierEngaged transitions DO re-render (state), so
  // modifier-driven cursors (e.g. hand-while-space) update correctly.
  // Reactive cursor changes during an in-flight gesture (e.g. grab→grabbing
  // mid-drag) need a `gestureTick` state on useTools — tracked in TODO.
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
    editAnchors: editAnchorsProp,
    editAnchorsController: editAnchorsOverride,
    selection: selectionOverride,
    selectionOptions,
    hitBody,
    resizeTarget,
    rotateTarget,
    rotationHandleDistance,
    boundsOf,
    onBodyHit,
    onTapEmpty,
    clientToWorld,
    handleHitRadius,
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

  const [editingAnchors, setEditingAnchors] = useState<{ objectId: string } | null>(null);
  const editAnchorsEnabled = editAnchorsProp !== undefined && editAnchorsProp !== false;
  const editAnchorsOpts = (typeof editAnchorsProp === 'object' ? editAnchorsProp : {}) as UseEditAnchorsOptions;
  const editAnchorsAdapter = useMemo<EditAnchorsAdapter<TObject>>(() => ({
    getObject: (id) => effectiveAdapter.getObject?.(id) ?? ({ id } as TObject),
    getPose: (id) => effectiveAdapter.getPose(id) as unknown as Path,
    setPose: (id, pose) => (effectiveAdapter as { setPose: (id: string, pose: unknown) => void }).setPose(id, pose),
    applyBatch: effectiveAdapter.applyBatch
      ? (ops, label) => effectiveAdapter.applyBatch!(ops, label ?? 'Edit anchors')
      : undefined,
  }), [effectiveAdapter]);
  const internalEditAnchors = useEditAnchors<TObject>(editAnchorsAdapter, {
    ...editAnchorsOpts,
    editingId: editingAnchors?.objectId ?? null,
    debug: debugSink ?? undefined,
  });
  const editAnchorsCtl = editAnchorsOverride ?? (editAnchorsEnabled ? internalEditAnchors : undefined);

  // Default hitBody: walk the adapter's objects back-to-front and return the
  // first whose pose contains the world point. The active tool (selectTool)
  // typically owns its own hitBody internally; this fallback exists for
  // layer-level concerns (selection-overlay handle hit, custom layer queries)
  // and for the no-tools path where Canvas dispatches via usePointerGestures.
  const baseHitBody = useMemo(() => {
    if (hitBody) return hitBody;
    if (!adapter) return undefined;
    const a = adapter;
    return (worldX: number, worldY: number): string | string[] | null => {
      const objs = a.getObjects();
      const point = { x: worldX, y: worldY, width: 0, height: 0 };
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        const pose = a.getPose(o.id);
        const hit = geometry.intersectsRect
          ? geometry.intersectsRect(pose, point)
          : aabbContains(geometry.getBounds(pose), worldX, worldY);
        if (hit) return o.id;
      }
      return null;
    };
  }, [hitBody, adapter, geometry]);

  // Committed pose/bounds lookups. Live overlay state during a drag now
  // arrives via the active Tool's `peekPose`/`peekBounds`; helpersForLayers
  // composes that on top of these committed lookups below.
  const baseBoundsOf = useMemo(() => {
    if (boundsOf) return boundsOf;
    if (!adapter) return undefined;
    return (id: string): Bounds | null => {
      try {
        return geometry.getBounds(adapter.getPose(id));
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

  const unionOfSelection = useCallback(
    (ids: string[]): Bounds | null => {
      if (!baseBoundsOf || ids.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let any = false;
      for (const id of ids) {
        const b = baseBoundsOf(id);
        if (!b) continue;
        any = true;
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + b.height > maxY) maxY = b.y + b.height;
      }
      if (!any) return null;
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    },
    [baseBoundsOf],
  );

  // boundsOf: when the queried id is the synthetic multi-selection id (used
  // by resizeTarget below), return the union of selected bounds. For real
  // ids fall through to the base resolver.
  const effectiveBoundsOf = useMemo(() => {
    if (boundsOf) return boundsOf;
    if (!baseBoundsOf) return undefined;
    return (id: string): Bounds | null => {
      if (multiActive && id === MULTI_RESIZE_TARGET_ID) {
        return unionOfSelection(selectedIdsForWiring);
      }
      return baseBoundsOf(id);
    };
  }, [boundsOf, baseBoundsOf, multiActive, selectedIdsForWiring, unionOfSelection]);

  // helpersForLayers: overlay-aware lookups passed to every RenderLayer.draw
  // call (as the `data` arg) so custom layers can read live overlay state
  // directly from their draw closure. The legacy `helpersRef` prop still
  // mirrors the same value for back-compat. The active Tool's `peekPose`/
  // `peekBounds` is the only overlay source post-cleanup; falls through to
  // the committed adapter pose / bounds when no tool is mid-gesture.
  const peekToolPose = (id: string): TPose | null => {
    if (!tools) return null;
    const tool = tools.registry[tools.modifierEngaged ?? tools.active];
    const p = tool?.peekPose?.(id);
    return (p ?? null) as TPose | null;
  };
  const peekToolBounds = (id: string): Bounds | null => {
    if (!tools) return null;
    const tool = tools.registry[tools.modifierEngaged ?? tools.active];
    const b = tool?.peekBounds?.(id);
    if (b) return b;
    const p = tool?.peekPose?.(id);
    return p == null ? null : geometry.getBounds(p as TPose);
  };

  const helpersForLayers: CanvasHelpers<TPose> = {
    getEffectivePose: (id: string): TPose | null => {
      const tp = peekToolPose(id);
      if (tp != null) return tp;
      return committedPoseOf(id);
    },
    getEffectiveBounds: (id: string): Bounds | null => {
      const tb = peekToolBounds(id);
      if (tb != null) return tb;
      if (effectiveBoundsOf) return effectiveBoundsOf(id);
      const p = committedPoseOf(id);
      return p == null ? null : geometry.getBounds(p);
    },
  };
  if (helpersRef) helpersRef.current = helpersForLayers;

  // hitBody: in multi mode with >1 selected, a click inside the union AABB
  // that doesn't land on an unselected leaf drags the whole set without
  // perturbing the selection. Clicks on unselected leaves fall through to
  // the base hit, so applyClick (or shift-click extend) takes over.
  const effectiveHitBody = useMemo(() => {
    if (hitBody) return hitBody;
    if (!baseHitBody) return undefined;
    if (!multiActive) return baseHitBody;
    return (worldX: number, worldY: number): string | string[] | null => {
      const hit = baseHitBody(worldX, worldY);
      // pickTopMostHit so parent/child collapse in multi-mode matches
      // single-mode (container's body shouldn't outrank its child).
      const hitId = Array.isArray(hit) ? pickTopMostHit(hit, adapter ?? null) : hit;
      const selected = selectedIdsForWiring;
      const selectedSet = new Set(selected);
      if (hitId !== null && selectedSet.has(hitId)) {
        return selected;
      }
      if (hitId !== null) {
        return hit;
      }
      const u = unionOfSelection(selected);
      if (u && worldX >= u.x && worldX <= u.x + u.width && worldY >= u.y && worldY <= u.y + u.height) {
        return selected;
      }
      return null;
    };
  }, [hitBody, baseHitBody, multiActive, selectedIdsForWiring, unionOfSelection]);

  // resizeTarget: with multi selection active, expose a synthetic id whose
  // bounds are the union of the selection. resize.expandIds (wired via
  // derivedResizeOptions above) rewrites that id back into the leaf list so
  // useResize takes its existing group path.
  const effectiveResizeTarget = useMemo(() => {
    if (resizeTarget) return resizeTarget;
    if (!multiActive) return undefined;
    return (): { id: string; bounds: Bounds } | null => {
      const u = unionOfSelection(selectedIdsForWiring);
      return u ? { id: MULTI_RESIZE_TARGET_ID, bounds: u } : null;
    };
  }, [resizeTarget, multiActive, selectedIdsForWiring, unionOfSelection]);

  // onBodyHit: in multi mode, a hit on an already-selected id without the
  // extend modifier preserves the selection (so the move drag covers the
  // whole set). Hits on unselected leaves still dispatch applyClick.
  const effectiveOnBodyHit = useMemo(() => {
    if (onBodyHit) return onBodyHit;
    if (selectionMode !== 'multi') return undefined;
    return (ids: string[], ctx: PointerGestureCallbackCtx) => {
      const sel = effectiveSelection;
      const first = ids[0];
      if (first === undefined) return;
      const cur = sel.get();
      const inSelection = cur.includes(first);
      const extending = ctx.modifiers.shift || ctx.modifiers.meta || ctx.modifiers.ctrl;
      if (inSelection && cur.length > 1 && !extending) return;
      sel.applyClick(first, ctx.modifiers);
    };
  }, [onBodyHit, selectionMode, effectiveSelection]);

  const bindings = usePointerGestures<TPose, TPose>({
    editAnchors: editAnchorsCtl as unknown as EditAnchorsController<{ id: string }> | undefined,
    editAnchorsActive: !!editingAnchors,
    hitBody: effectiveHitBody,
    resizeTarget: effectiveResizeTarget ?? resizeTarget,
    rotateTarget,
    rotationHandleDistance,
    selection: selectionMode === 'none' ? undefined : effectiveSelection,
    boundsOf: effectiveBoundsOf,
    onBodyHit: effectiveOnBodyHit ?? onBodyHit,
    onTapEmpty,
    clientToWorld,
    handleHitRadius,
    getView: () => viewRef.current,
    debug: debugSink ?? undefined,
  });

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
      : (e: React.PointerEvent<HTMLCanvasElement>) => {
          if (autoFocusOnPointerDown) e.currentTarget.focus();
          bindings.onPointerDown(e);
        });
  const handlePointerMove = onPointerMoveOverride ??
    (tools
      ? (e: React.PointerEvent<HTMLCanvasElement>) => tools.dispatcher.onPointerMove(e.nativeEvent)
      : bindings.onPointerMove);
  const handlePointerUp = onPointerUpOverride ??
    (tools
      ? (e: React.PointerEvent<HTMLCanvasElement>) => {
          tools.dispatcher.onPointerUp(e.nativeEvent);
          // The doc-listener up handler also detaches; this branch covers the
          // common case where the release lands on the canvas itself.
          detachDocListeners();
        }
      : bindings.onPointerUp);
  const handlePointerCancel = onPointerCancelOverride ?? bindings.onPointerCancel;
  const handleWheel = tools
    ? (e: React.WheelEvent<HTMLCanvasElement>) => tools.dispatcher.onWheel(e.nativeEvent)
    : undefined;

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!editAnchorsEnabled || !adapter) return;
      const cw = clientToWorld ?? ((c: HTMLCanvasElement, cx: number, cy: number): [number, number] => {
        const r = c.getBoundingClientRect();
        const v = viewRef.current;
        return [(cx - r.left) / v.scale + v.x, (cy - r.top) / v.scale + v.y];
      });
      const [wx, wy] = cw(e.currentTarget, e.clientX, e.clientY);
      // WHY: use the consumer's hitBody so open paths (no fill, pointInPath=false)
      //      can still enter edit mode via their AABB-padded hit silhouette.
      const hit = effectiveHitBody?.(wx, wy);
      const ids = hit == null ? [] : Array.isArray(hit) ? hit : [hit];
      for (let i = ids.length - 1; i >= 0; i--) {
        const id = ids[i];
        const pose = adapter.getPose(id) as unknown as Path;
        if (!pose || pose.kind !== 'polygon') continue;
        setEditingAnchors({ objectId: id });
        return;
      }
    },
    [editAnchorsEnabled, adapter, clientToWorld, effectiveHitBody],
  );

  useEffect(() => {
    if (!editingAnchors) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingAnchors(null);
        editAnchorsCtl?.cancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingAnchors, editAnchorsCtl]);

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
        (id) => peekToolPose(id),
        null,
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
          if (multiActive && id === MULTI_RESIZE_TARGET_ID) {
            const u = unionOfSelection(selectedIds);
            return u ? (u as unknown as TPose) : null;
          }
          // Active tool's overlay (move/resize/rotate ghost) wins so the
          // selection chrome tracks the in-flight pose during a drag.
          const tp = peekToolPose(id);
          if (tp != null) return tp;
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
      const editingId = editingAnchors?.objectId;
      const getSelection = multiActive
        ? () => [MULTI_RESIZE_TARGET_ID]
        : editingId
          ? () => selectedIds.filter((id) => id !== editingId)
          : () => selectedIds;
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

    const anchorEditSlot = layersMap.anchorEditOverlay as AnchorEditOverlaySlotConfig | null | undefined;
    if (anchorEditSlot !== null && editAnchorsCtl) {
      standardLayers.anchorEditOverlay = createAnchorEditOverlayLayer({
        ...(anchorEditSlot ?? {}),
        getOverlay: () => {
          const ov = editAnchorsCtl.overlay;
          return ov ? { pose: ov.pose, selectedAnchors: ov.selectedAnchors } : null;
        },
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
  }, [layersMap, adapter, selectedIds, effectiveBoundsOf, multiActive, unionOfSelection, editingAnchors, editAnchorsCtl, editAnchorsCtl?.overlay, debugSink, tools]);

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
    const ctx = c.getContext('2d');
    if (!ctx) return;
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
    setupCanvasDpr(c, ctx, width, height);
    ctx.clearRect(0, 0, width, height);
    if (background) {
      ctx.save();
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    runLayers(ctx, layersWithDebug, helpersForLayers, {}, undefined, effectiveView);
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
      onLostPointerCapture={tools ? undefined : bindings.onLostPointerCapture}
      onWheel={handleWheel}
      onDoubleClick={editAnchorsEnabled ? handleDoubleClick : undefined}
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
