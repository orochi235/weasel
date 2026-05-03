import { useCallback, useRef } from 'react';
import type React from 'react';
import { clientToCanvas } from '../features/viewport/clientToCanvas';
import { cornerResizeHandles, hitCornerHandle } from './gestures/resize/cornerHandles';
import type { UseMoveReturn } from './gestures/move/move';
import type { UseResizeReturn } from './gestures/resize/resize';
import type { ModifierState } from './gestures/types';
import type { SelectionApi } from '../features/selection/useSelection';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pointer event handlers ready to spread onto a `<canvas>`. */
export interface PointerGestureBindings {
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
}

/** Context object passed to body-hit / tap-empty callbacks. */
export interface PointerGestureCallbackCtx {
  event: React.PointerEvent<HTMLCanvasElement>;
  worldX: number;
  worldY: number;
  modifiers: ModifierState;
}

export interface UsePointerGesturesOptions<TMovePose, TResizePose> {
  /** clientX/Y → world coords. Default: `clientToCanvas` (no pan/zoom). Apps
   *  with a viewport transform compose pan/zoom into this callback. */
  clientToWorld?: (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
  ) => [number, number];

  /** Live move interaction. Omit to disable body-drag dispatch. */
  move?: UseMoveReturn<{ id: string }, TMovePose>;

  /** Live resize interaction. Omit to disable handle-drag dispatch. */
  resize?: UseResizeReturn<{ id: string }, TResizePose>;

  /** Currently resizable target. Hook computes corner handles, hit-tests, and
   *  dispatches `resize.start(id, anchor, ...)`. Return `null` for none.
   *
   *  When omitted but `selection` and `boundsOf` are both supplied, defaults
   *  to single-selection bounds (multi-selection returns `null`). */
  resizeTarget?: () => { id: string; bounds: Bounds } | null;

  /** Hit-test radius for resize handles, in world pixels. Default 8. */
  handleHitRadius?: number;

  /** Body hit-test for starting a move. Return id(s) to drag, or `null` to
   *  fall through to `onTapEmpty`. */
  hitBody?: (worldX: number, worldY: number) => string | string[] | null;

  /** Selection api (see {@link SelectionApi}). When supplied, the hook wires
   *  selection-driven defaults: `onBodyHit` defaults to `selection.applyClick`
   *  for the first hit id, `onTapEmpty` defaults to `selection.clear`, and
   *  body-drag promotes-then-drags (clicking an unselected obj selects it
   *  first, then drags the resulting selection; clicking a selected obj
   *  drags the entire selection). Explicit callbacks override these defaults. */
  selection?: SelectionApi;

  /** Per-id bounds lookup. Combined with `selection`, defaults `resizeTarget`
   *  to single-selection bounds when `resizeTarget` is not explicitly passed. */
  boundsOf?: (id: string) => Bounds | null;

  /** Called whenever a body hit occurs. Fires regardless of whether `move` is
   *  wired — selection-only callers still receive notifications. */
  onBodyHit?: (ids: string[], ctx: PointerGestureCallbackCtx) => void;

  /** Called when the pointer hits neither a handle nor a body. Defaults to
   *  `selection.clear()` when `selection` is supplied. */
  onTapEmpty?: (ctx: PointerGestureCallbackCtx) => void;
}

/**
 * Pointer-event dispatcher that wires `useMove` + `useResize` to a canvas.
 * Owns the four `onPointer*` handlers, modifier extraction, world-coord
 * conversion, pointer capture, and the handle-vs-body dispatch decision.
 *
 * Caller still owns selection state, what counts as a body, and which
 * object (if any) is currently resizable. Pass a `selection` from
 * {@link useSelection} to opt into the standard click-promote-drag flow
 * with no extra wiring.
 *
 * Spread the returned bindings onto a `<canvas>`:
 * ```tsx
 * const bindings = usePointerGestures({ move, resize, hitBody, selection });
 * return <canvas ref={canvasRef} {...bindings} />;
 * ```
 */
export function usePointerGestures<TMovePose, TResizePose>(
  options: UsePointerGesturesOptions<TMovePose, TResizePose>,
): PointerGestureBindings {
  const {
    clientToWorld = clientToCanvas,
    move,
    resize,
    handleHitRadius = 8,
    hitBody,
    selection,
    boundsOf,
    onBodyHit,
    onTapEmpty,
  } = options;

  // Resolve resizeTarget: explicit > selection-derived
  const explicitResizeTarget = options.resizeTarget;
  const resizeTarget = useCallback((): { id: string; bounds: Bounds } | null => {
    if (explicitResizeTarget) return explicitResizeTarget();
    if (selection && boundsOf) {
      const ids = selection.get();
      if (ids.length !== 1) return null;
      const b = boundsOf(ids[0]);
      return b ? { id: ids[0], bounds: b } : null;
    }
    return null;
  }, [explicitResizeTarget, selection, boundsOf]);

  const dragKindRef = useRef<'move' | 'resize' | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const [wx, wy] = clientToWorld(e.currentTarget, e.clientX, e.clientY);
      const modifiers: ModifierState = {
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        ctrl: e.ctrlKey,
      };
      const ctx: PointerGestureCallbackCtx = { event: e, worldX: wx, worldY: wy, modifiers };

      if (resize) {
        const target = resizeTarget();
        if (target) {
          for (const h of cornerResizeHandles(target.bounds)) {
            if (hitCornerHandle(h, wx, wy, handleHitRadius)) {
              dragKindRef.current = 'resize';
              e.currentTarget.setPointerCapture(e.pointerId);
              resize.start(target.id, h.anchor, wx, wy);
              return;
            }
          }
        }
      }

      if (hitBody) {
        const hit = hitBody(wx, wy);
        if (hit !== null) {
          const hitIds = Array.isArray(hit) ? hit : [hit];
          // Fire onBodyHit (explicit > selection-default).
          if (onBodyHit) {
            onBodyHit(hitIds, ctx);
          } else if (selection && hitIds.length > 0) {
            selection.applyClick(hitIds[0], modifiers);
          }
          // Now decide what to drag. With selection, drag the post-click
          // selection (so click-on-unselected promotes-then-drags). Without,
          // fall back to dragging the hit ids.
          if (move) {
            const dragIds = selection ? selection.get() : hitIds;
            if (dragIds.length > 0) {
              dragKindRef.current = 'move';
              e.currentTarget.setPointerCapture(e.pointerId);
              move.start({
                ids: dragIds,
                worldX: wx,
                worldY: wy,
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }
          }
          return;
        }
      }

      if (onTapEmpty) {
        onTapEmpty(ctx);
      } else if (selection) {
        selection.clear();
      }
    },
    [
      clientToWorld,
      move,
      resize,
      resizeTarget,
      handleHitRadius,
      hitBody,
      selection,
      onBodyHit,
      onTapEmpty,
    ],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const kind = dragKindRef.current;
      if (!kind) return;
      const [wx, wy] = clientToWorld(e.currentTarget, e.clientX, e.clientY);
      const modifiers: ModifierState = {
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        ctrl: e.ctrlKey,
      };
      if (kind === 'move' && move) {
        move.move({
          worldX: wx,
          worldY: wy,
          clientX: e.clientX,
          clientY: e.clientY,
          modifiers,
        });
      } else if (kind === 'resize' && resize) {
        resize.move(wx, wy, modifiers);
      }
    },
    [clientToWorld, move, resize],
  );

  const onPointerUp = useCallback(() => {
    const kind = dragKindRef.current;
    if (!kind) return;
    dragKindRef.current = null;
    if (kind === 'move') move?.end();
    else if (kind === 'resize') resize?.end();
  }, [move, resize]);

  const onPointerCancel = useCallback(() => {
    const kind = dragKindRef.current;
    if (!kind) return;
    dragKindRef.current = null;
    if (kind === 'move') move?.cancel();
    else if (kind === 'resize') resize?.cancel();
  }, [move, resize]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
