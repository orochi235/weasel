/**
 * Top-level `<Canvas>` component that wraps a single `<canvas>` element with:
 *   - DPR setup (`setupCanvasDpr`)
 *   - clear-rect + optional background fill on every render of `layers`
 *   - `runLayers` invocation
 *   - `usePointerGestures` wiring with all selection-aware defaults
 *   - keyboard-focus plumbing (`tabIndex` + auto-focus on pointerdown)
 *
 * Per-event `onPointer*` props REPLACE the auto-built handler for that event;
 * pass them only when you need to fully bypass the gesture machinery for
 * that event (rare). For augmenting (e.g. extra modifier handling), prefer
 * passing callbacks via the gesture slots.
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type React from 'react';
import { runLayers, type RenderLayer } from '../features/layers/render';
import { setupCanvasDpr } from '../features/viewport/pixelDensity';
import {
  usePointerGestures,
  type PointerGestureCallbackCtx,
} from '../interactions/usePointerGestures';
import { useSelection, type SelectionApi } from '../features/selection/useSelection';
import type { UseMoveReturn } from '../interactions/gestures/move/move';
import type { UseResizeReturn } from '../interactions/gestures/resize/resize';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasProps<TMovePose, TResizePose> {
  /** CSS-pixel width. */
  width: number;
  /** CSS-pixel height. */
  height: number;

  /** Layer stack to render. Re-runs whenever this reference changes. */
  layers: RenderLayer<unknown>[];

  // --- Gesture slots (fed straight into usePointerGestures) ---
  move?: UseMoveReturn<{ id: string }, TMovePose>;
  resize?: UseResizeReturn<{ id: string }, TResizePose>;
  /** Body hit-test. When omitted and `move` is supplied, defaults to a
   *  rect-pose hit-test that walks `move.adapter.getObjects()` top-most
   *  first and returns the first id whose `move.adapter.getPose(id)` AABB
   *  contains `(worldX, worldY)`. Override for non-rect poses or domain-
   *  specific hit-testing (e.g. group-aware resolution). */
  hitBody?: (worldX: number, worldY: number) => string | string[] | null;
  resizeTarget?: () => { id: string; bounds: Bounds } | null;
  /** Selection api. When omitted, `<Canvas>` calls {@link useSelection}
   *  internally with default options. Pass an explicit instance when the
   *  app needs `multi` mode, an extend key, or to share the selection
   *  with code outside the canvas. */
  selection?: SelectionApi;
  /** Per-id bounds lookup (for the resize-handle target). When omitted and
   *  `move` (and optionally `resize`) is supplied, defaults to:
   *    1. `move.overlay?.poses.get(id)` if a move overlay is live
   *    2. `resize.overlay.currentPose` if `resize.overlay.id === id`
   *    3. `move.adapter.getPose(id)` (or `resize.adapter.getPose(id)`)
   *  Assumes pose has rect fields (`x,y,width,height`). Override for non-
   *  rect poses or to compute group bounds. */
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
  /** CSS background fill (drawn after clearRect, before layers). Omit to skip. */
  background?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Default 0 (focusable). Pass `-1` to make it programmatically focusable only. */
  tabIndex?: number;
  /** Default true. When true, pointerdown focuses the canvas. */
  autoFocusOnPointerDown?: boolean;
}

function CanvasInner<TMovePose, TResizePose>(
  props: CanvasProps<TMovePose, TResizePose>,
  ref: React.ForwardedRef<HTMLCanvasElement>,
) {
  const {
    width,
    height,
    layers,
    move,
    resize,
    hitBody,
    resizeTarget,
    selection,
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

  // Always call useSelection (React rules forbid conditional hook calls).
  // Prefer the explicitly-supplied `selection` prop when present.
  const fallbackSelection = useSelection();
  const effectiveSelection: SelectionApi = selection ?? fallbackSelection;

  // Default hitBody: rect-pose AABB scan over move.adapter.getObjects().
  // Iterates in reverse so top-most (last-rendered) hits first.
  const moveOverlay = move?.overlay ?? null;
  const resizeOverlay = resize?.overlay ?? null;
  const effectiveHitBody = useMemo(() => {
    if (hitBody) return hitBody;
    if (!move || !move.adapter.getObjects) return undefined;
    const adapter = move.adapter;
    return (worldX: number, worldY: number): string | null => {
      const objs = adapter.getObjects!();
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        const p = adapter.getPose(o.id) as unknown as Bounds;
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

  // Default boundsOf: move overlay → resize overlay → adapter.getPose fallback.
  // Assumes rect-shaped pose; consumers override for non-rect.
  const effectiveBoundsOf = useMemo(() => {
    if (boundsOf) return boundsOf;
    if (!move && !resize) return undefined;
    return (id: string): Bounds | null => {
      const ov = move?.overlay?.poses.get(id);
      if (ov) return ov as unknown as Bounds;
      if (resize?.overlay && resize.overlay.id === id) {
        return resize.overlay.currentPose as unknown as Bounds;
      }
      const adapter = move?.adapter ?? resize?.adapter;
      if (!adapter) return null;
      try {
        return adapter.getPose(id) as unknown as Bounds;
      } catch {
        return null;
      }
    };
    // moveOverlay/resizeOverlay listed so a fresh closure is built when
    // the overlay reference changes (state-update during a live gesture).
  }, [boundsOf, move, resize, moveOverlay, resizeOverlay]);

  const bindings = usePointerGestures<TMovePose, TResizePose>({
    move,
    resize,
    hitBody: effectiveHitBody,
    resizeTarget,
    selection: effectiveSelection,
    boundsOf: effectiveBoundsOf,
    onBodyHit,
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
 * Forward-ref'd `<canvas>` wrapper. Generic over the move and resize pose
 * types — TypeScript will infer them from the `move` / `resize` props when
 * supplied. When neither is provided, the parameters fall back to `unknown`.
 */
export const Canvas = forwardRef(CanvasInner) as <TMovePose = unknown, TResizePose = unknown>(
  props: CanvasProps<TMovePose, TResizePose> & { ref?: React.ForwardedRef<HTMLCanvasElement> },
) => ReturnType<typeof CanvasInner>;
