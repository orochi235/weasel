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

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type React from 'react';
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
import { useMove } from '../interactions/gestures/move/move';
import type { MoveController, UseMoveOptions } from '../interactions/gestures/move/move';
import { useResize } from '../interactions/gestures/resize/resize';
import type { ResizeController, UseResizeOptions } from '../interactions/gestures/resize/resize';
import type { MoveAdapter, ResizeAdapter } from '../core/adapters/types';
import { createGridLayer, type GridLayerOpts } from '../features/grid/layer';
import {
  createCellHighlightLayer,
  type CellHighlightLayerOpts,
} from '../features/grid/cellHighlight';
import {
  createSelectionOverlayLayer,
  type SelectionOverlayLayerOpts,
} from '../features/selection/overlay';
import type { MoveOverlay, ResizeOverlay } from '../interactions/gestures/types';

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
  'moveOverlay',
  'resizeOverlay',
  'selectionOverlay',
] as const;
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
  drawOne: (ctx: CanvasRenderingContext2D, obj: TObject, pose: TPose) => void;
  /** Default ghost alpha for the move-overlay slot. Default 0.85. */
  ghostAlpha?: number;
}

/** Move-overlay slot config. */
export interface MoveOverlaySlotConfig {
  /** Ghost alpha override (otherwise scene's `ghostAlpha` is used). */
  ghostAlpha?: number;
}
export type ResizeOverlaySlotConfig = Record<string, never>;

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
  | MoveOverlaySlotConfig
  | ResizeOverlaySlotConfig
  | SelectionOverlaySlotConfig<TPose>;

export type LayerSlotValue<TObject extends { id: string }, TPose> =
  | StandardSlotConfig<TObject, TPose>
  | CustomLayerEntry
  | null;

export type LayersMap<TObject extends { id: string }, TPose> = {
  grid?: GridSlotConfig | null;
  scene?: SceneSlotConfig<TObject, TPose> | null;
  moveOverlay?: MoveOverlaySlotConfig | null;
  resizeOverlay?: ResizeOverlaySlotConfig | null;
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
 *     `onBodyHit` and `onTapEmpty` still fire so consumers can do their own
 *     picking.
 *
 * Escape hatches still apply: explicit `selection`, `hitBody`, `boundsOf`,
 * `resizeTarget`, `onBodyHit`, `onTapEmpty`, or `selectionOptions.mode`
 * override the `selectionMode`-derived defaults.
 */
export type CanvasSelectionMode = 'single' | 'multi' | 'none';

const MULTI_RESIZE_TARGET_ID = '__weasel:multi-selection';

export interface CanvasProps<TObject extends { id: string } = { id: string }, TPose = unknown> {
  /** CSS-pixel width. */
  width: number;
  /** CSS-pixel height. */
  height: number;

  /** Combined adapter. Required for the scene slot, default hitBody/boundsOf,
   *  and the internal move/resize controllers. Optional for trivial canvases. */
  adapter?: MoveAdapter<TObject, TPose> & ResizeAdapter<TObject, TPose>;

  /** Selection semantics. See {@link CanvasSelectionMode}. Default `'single'`. */
  selectionMode?: CanvasSelectionMode;

  /** Layer map. See module docstring for slot semantics. */
  layers: LayersMap<TObject, TPose>;

  // --- Internal hook overrides / configuration ---
  move?: MoveController<TObject, TPose>;
  moveOptions?: UseMoveOptions<TPose>;
  resize?: ResizeController<TObject, TPose>;
  resizeOptions?: UseResizeOptions<TPose>;
  selection?: SelectionApi;
  selectionOptions?: UseSelectionOptions;

  // --- Gesture overrides (escape hatches for non-rect / group-aware apps) ---
  hitBody?: (worldX: number, worldY: number) => string | string[] | null;
  resizeTarget?: () => { id: string; bounds: Bounds } | null;
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
}

const STANDARD_SLOT_SET = new Set<string>(STANDARD_SLOTS);

function isCustomEntry(v: unknown): v is CustomLayerEntry {
  return !!v && typeof v === 'object' && 'layer' in (v as Record<string, unknown>);
}

function buildSceneLayer<TObject extends { id: string }, TPose>(
  cfg: SceneSlotConfig<TObject, TPose>,
  adapter: (MoveAdapter<TObject, TPose> & ResizeAdapter<TObject, TPose>) | undefined,
  moveOverlay: MoveOverlay<TPose> | null,
  resizeOverlay: ResizeOverlay<TPose> | null,
): RenderLayer<unknown> {
  const toPose =
    cfg.toPose ??
    ((obj: TObject) => (adapter ? adapter.getPose(obj.id) : (obj as unknown as TPose)));
  return {
    id: 'scene',
    label: 'Scene',
    draw: (ctx) => {
      const objects = cfg.objects ?? adapter?.getObjects() ?? [];
      const hide = moveOverlay?.hideIds?.length ? new Set(moveOverlay.hideIds) : null;
      for (const obj of objects) {
        if (hide && hide.has(obj.id)) continue;
        let pose: TPose;
        const moved = moveOverlay?.poses.get(obj.id);
        if (moved !== undefined) pose = moved;
        else if (resizeOverlay && resizeOverlay.id === obj.id) pose = resizeOverlay.currentPose;
        else if (resizeOverlay?.leafPoses?.has(obj.id))
          pose = resizeOverlay.leafPoses.get(obj.id)!;
        else pose = toPose(obj);
        cfg.drawOne(ctx, obj, pose);
      }
    },
  };
}

function buildMoveOverlayLayer<TObject extends { id: string }, TPose>(
  scene: SceneSlotConfig<TObject, TPose>,
  adapter: (MoveAdapter<TObject, TPose> & ResizeAdapter<TObject, TPose>) | undefined,
  moveOverlay: MoveOverlay<TPose> | null,
  alpha: number,
): RenderLayer<unknown> | null {
  if (!moveOverlay) return null;
  const drawOne = scene.drawOne;
  return {
    id: 'move-ghost',
    label: 'Move ghost',
    draw: (ctx) => {
      if (moveOverlay.draggedIds.length === 0) return;
      const objects = scene.objects ?? adapter?.getObjects() ?? [];
      const byId = new Map(objects.map((o) => [o.id, o] as const));
      ctx.save();
      ctx.globalAlpha = alpha;
      for (const id of moveOverlay.draggedIds) {
        const pose = moveOverlay.poses.get(id);
        const obj = byId.get(id);
        if (!pose || !obj) continue;
        drawOne(ctx, obj, pose);
      }
      ctx.restore();
    },
  };
}

function CanvasInner<TObject extends { id: string }, TPose>(
  props: CanvasProps<TObject, TPose>,
  ref: React.ForwardedRef<HTMLCanvasElement>,
) {
  const {
    width,
    height,
    adapter,
    selectionMode = 'single',
    layers: layersMap,
    move: moveOverride,
    moveOptions,
    resize: resizeOverride,
    resizeOptions,
    selection: selectionOverride,
    selectionOptions,
    hitBody,
    resizeTarget,
    boundsOf,
    onBodyHit,
    onTapEmpty,
    clientToWorld,
    handleHitRadius,
    onPointerDown: onPointerDownOverride,
    onPointerMove: onPointerMoveOverride,
    onPointerUp: onPointerUpOverride,
    onPointerCancel: onPointerCancelOverride,
    background,
    className,
    style,
    tabIndex = 0,
    autoFocusOnPointerDown = true,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement, []);

  // Internal hooks always run (rules of hooks). They consult a noop adapter
  // when none is supplied; their controllers are then unused because the
  // gesture wiring below only enables move/resize when `adapter` is present.
  const noopAdapter = useMemo(
    () =>
      ({
        getPose: () => ({}) as TPose,
        getObjects: () => [],
      }) as unknown as MoveAdapter<TObject, TPose> & ResizeAdapter<TObject, TPose>,
    [],
  );
  const effectiveAdapter = adapter ?? noopAdapter;

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

  // When selectionMode === 'multi', resize handles operate on a synthetic
  // group id; expandIds rewrites that into the live selection so useResize
  // takes its existing group path (union AABB origin → per-leaf remap).
  const selectionRef = useRef<SelectionApi>(effectiveSelection);
  selectionRef.current = effectiveSelection;
  const derivedResizeOptions = useMemo<UseResizeOptions<TPose> | undefined>(() => {
    if (selectionMode !== 'multi') return resizeOptions;
    const userExpand = resizeOptions?.expandIds;
    const expandIds = (ids: string[]): string[] => {
      if (ids.length === 1 && ids[0] === MULTI_RESIZE_TARGET_ID) {
        return selectionRef.current.get();
      }
      return userExpand ? userExpand(ids) : ids;
    };
    return { ...(resizeOptions ?? {}), expandIds } as UseResizeOptions<TPose>;
  }, [resizeOptions, selectionMode]);

  const internalMove = useMove<TObject, TPose>(effectiveAdapter, moveOptions);
  const internalResize = useResize<TObject, TPose>(effectiveAdapter, derivedResizeOptions ?? {});

  const move = moveOverride ?? (adapter ? internalMove : undefined);
  const resize = resizeOverride ?? (adapter ? internalResize : undefined);

  const moveOverlay = move?.overlay ?? null;
  const resizeOverlay = resize?.overlay ?? null;

  const baseHitBody = useMemo(() => {
    if (hitBody) return hitBody;
    if (!move) return undefined;
    const a = move.adapter;
    return (worldX: number, worldY: number): string | string[] | null => {
      const objs = a.getObjects();
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        const p = a.getPose(o.id) as unknown as Bounds;
        if (
          worldX >= p.x &&
          worldX <= p.x + p.width &&
          worldY >= p.y &&
          worldY <= p.y + p.height
        ) {
          return o.id;
        }
      }
      return null;
    };
  }, [hitBody, move]);

  const baseBoundsOf = useMemo(() => {
    if (boundsOf) return boundsOf;
    if (!move && !resize) return undefined;
    return (id: string): Bounds | null => {
      const ov = move?.overlay?.poses.get(id);
      if (ov) return ov as unknown as Bounds;
      if (resize?.overlay) {
        if (resize.overlay.id === id) return resize.overlay.currentPose as unknown as Bounds;
        const leaf = resize.overlay.leafPoses?.get(id);
        if (leaf !== undefined) return leaf as unknown as Bounds;
      }
      const a = move?.adapter ?? resize?.adapter;
      if (!a) return null;
      try {
        return a.getPose(id) as unknown as Bounds;
      } catch {
        return null;
      }
    };
  }, [boundsOf, move, resize, moveOverlay, resizeOverlay]);

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
      const hitId = Array.isArray(hit) ? hit[0] ?? null : hit;
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
    move,
    resize,
    hitBody: effectiveHitBody,
    resizeTarget: effectiveResizeTarget ?? resizeTarget,
    selection: selectionMode === 'none' ? undefined : effectiveSelection,
    boundsOf: effectiveBoundsOf,
    onBodyHit: effectiveOnBodyHit ?? onBodyHit,
    onTapEmpty,
    clientToWorld,
    handleHitRadius,
  });

  const handlePointerDown =
    onPointerDownOverride ??
    ((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (autoFocusOnPointerDown) e.currentTarget.focus();
      bindings.onPointerDown(e);
    });
  const handlePointerMove = onPointerMoveOverride ?? bindings.onPointerMove;
  const handlePointerUp = onPointerUpOverride ?? bindings.onPointerUp;
  const handlePointerCancel = onPointerCancelOverride ?? bindings.onPointerCancel;

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
      standardLayers.scene = buildSceneLayer(sceneCfg, adapter, moveOverlay, resizeOverlay);
    }

    const moveSlot = layersMap.moveOverlay as MoveOverlaySlotConfig | null | undefined;
    if (moveSlot !== null && sceneCfg) {
      const alpha =
        (moveSlot as MoveOverlaySlotConfig | undefined)?.ghostAlpha ?? sceneCfg.ghostAlpha ?? 0.85;
      const ghost = buildMoveOverlayLayer(sceneCfg, adapter, moveOverlay, alpha);
      if (ghost) standardLayers.moveOverlay = ghost;
    }

    // resizeOverlay slot: the scene fold-in already paints the resized pose,
    // so this slot is currently a no-op hook point. Reserved for a future
    // standalone ghost rendering pass; intentionally not built here.

    const selSlot = layersMap.selectionOverlay as
      | SelectionOverlaySlotConfig<TPose>
      | null
      | undefined;
    if (selSlot !== null) {
      const cfg = (selSlot ?? {}) as SelectionOverlaySlotConfig<TPose>;
      const poseById =
        cfg.poseById ??
        ((id: string): TPose | null => {
          if (multiActive && id === MULTI_RESIZE_TARGET_ID) {
            const u = unionOfSelection(selectedIds);
            return u ? (u as unknown as TPose) : null;
          }
          if (effectiveBoundsOf) {
            const b = effectiveBoundsOf(id);
            return (b as unknown as TPose) ?? null;
          }
          if (!adapter) return null;
          try {
            return adapter.getPose(id);
          } catch {
            return null;
          }
        });
      const getSelection = multiActive
        ? () => [MULTI_RESIZE_TARGET_ID]
        : () => selectedIds;
      standardLayers.selectionOverlay = createSelectionOverlayLayer<TPose>({
        ...cfg,
        getSelection,
        getPose: poseById,
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
    return out;
  }, [layersMap, adapter, moveOverlay, resizeOverlay, selectedIds, effectiveBoundsOf, multiActive, unionOfSelection]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    setupCanvasDpr(c, ctx, width, height);
    ctx.clearRect(0, 0, width, height);
    if (background) {
      ctx.save();
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    runLayers(ctx, layers, undefined, {});
  }, [layers, width, height, background]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      tabIndex={tabIndex}
      className={className}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}

/**
 * Forward-ref'd `<canvas>` wrapper. Generic over the object and pose types —
 * TypeScript will infer them from the `adapter` (or `move`/`resize`) prop.
 */
export const Canvas = forwardRef(CanvasInner) as <
  TObject extends { id: string } = { id: string },
  TPose = unknown,
>(
  props: CanvasProps<TObject, TPose> & { ref?: React.ForwardedRef<HTMLCanvasElement> },
) => ReturnType<typeof CanvasInner>;
