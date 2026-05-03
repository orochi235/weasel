import { useCallback, useRef } from 'react';
import type React from 'react';
import { clientToCanvas } from '../features/viewport/clientToCanvas';
import { cornerResizeHandles, hitCornerHandle } from './gestures/resize/cornerHandles';
import type { MoveController } from './gestures/move/move';
import type { ResizeController } from './gestures/resize/resize';
import type { RotateController } from './gestures/rotate/rotate';
import type { InsertController } from './gestures/insert/insert';
import type { AreaSelectController } from './gestures/area-select/areaSelect';
import {
  rotationHandle,
  hitRotationHandle,
  DEFAULT_ROTATION_HANDLE_DISTANCE,
} from './gestures/rotate/handle';
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
  move?: MoveController<{ id: string }, TMovePose>;

  /** Live resize interaction. Omit to disable handle-drag dispatch. */
  resize?: ResizeController<{ id: string }, TResizePose>;

  /** Live rotation interaction. Omit to disable rotation-handle dispatch. */
  rotate?: RotateController<{ id: string }, TResizePose>;

  /** Live insert interaction. When `tool === 'insert'`, an empty-space
   *  pointer-down dispatches to `insert.start` instead of `onTapEmpty`. */
  insert?: InsertController<{ id: string }, unknown>;

  /** Live area-select interaction. When `tool === 'select'` (or undefined),
   *  an empty-space pointer-down dispatches to `areaSelect.start` instead of
   *  `onTapEmpty`. */
  areaSelect?: AreaSelectController;

  /** Empty-space tool. Default `'select'`. Picks insert vs area-select on
   *  empty-space pointer-down. Ignored if neither controller is wired. */
  tool?: 'select' | 'insert';

  /** Currently rotatable target. The hook positions the rotation handle
   *  above the (rotated) top-center of `bounds` and dispatches
   *  `rotate.start({ id, ... })` on hit.
   *
   *  When omitted but `rotate`, `selection`, and `boundsOf` are all
   *  supplied, defaults to single-selection bounds (multi → null). */
  rotateTarget?: () => { id: string; bounds: Bounds; rotation?: number } | null;

  /** World-pixel distance from the top edge to the rotation handle.
   *  Default `DEFAULT_ROTATION_HANDLE_DISTANCE`. */
  rotationHandleDistance?: number;

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
    rotate,
    insert,
    areaSelect,
    tool = 'select',
    handleHitRadius = 8,
    rotationHandleDistance = DEFAULT_ROTATION_HANDLE_DISTANCE,
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

  const explicitRotateTarget = options.rotateTarget;
  const rotateTarget = useCallback(
    (): { id: string; bounds: Bounds; rotation?: number } | null => {
      if (explicitRotateTarget) return explicitRotateTarget();
      if (rotate && selection && boundsOf) {
        const ids = selection.get();
        if (ids.length !== 1) return null;
        const b = boundsOf(ids[0]);
        if (!b) return null;
        const rotation = (b as Bounds & { rotation?: number }).rotation;
        return { id: ids[0], bounds: b, rotation };
      }
      return null;
    },
    [explicitRotateTarget, rotate, selection, boundsOf],
  );

  const dragKindRef = useRef<'move' | 'resize' | 'rotate' | 'insert' | 'area' | null>(null);

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

      if (rotate) {
        const target = rotateTarget();
        if (target) {
          const handle = rotationHandle(
            { ...target.bounds, rotation: target.rotation ?? 0 },
            rotationHandleDistance,
          );
          if (hitRotationHandle(handle, wx, wy, handleHitRadius)) {
            dragKindRef.current = 'rotate';
            e.currentTarget.setPointerCapture(e.pointerId);
            rotate.start({ id: target.id, worldX: wx, worldY: wy });
            return;
          }
        }
      }

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

      if (tool === 'insert' && insert) {
        dragKindRef.current = 'insert';
        e.currentTarget.setPointerCapture(e.pointerId);
        insert.start(wx, wy, modifiers);
        return;
      }
      if (areaSelect) {
        dragKindRef.current = 'area';
        e.currentTarget.setPointerCapture(e.pointerId);
        areaSelect.start(wx, wy, modifiers);
        return;
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
      rotate,
      insert,
      areaSelect,
      tool,
      resizeTarget,
      rotateTarget,
      rotationHandleDistance,
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
      } else if (kind === 'rotate' && rotate) {
        rotate.move({ worldX: wx, worldY: wy, modifiers });
      } else if (kind === 'insert' && insert) {
        insert.move(wx, wy, modifiers);
      } else if (kind === 'area' && areaSelect) {
        areaSelect.move(wx, wy, modifiers);
      }
    },
    [clientToWorld, move, resize, rotate, insert, areaSelect],
  );

  const onPointerUp = useCallback(() => {
    const kind = dragKindRef.current;
    if (!kind) return;
    dragKindRef.current = null;
    if (kind === 'move') move?.end();
    else if (kind === 'resize') resize?.end();
    else if (kind === 'rotate') rotate?.end();
    else if (kind === 'insert') insert?.end();
    else if (kind === 'area') areaSelect?.end();
  }, [move, resize, rotate, insert, areaSelect]);

  const onPointerCancel = useCallback(() => {
    const kind = dragKindRef.current;
    if (!kind) return;
    dragKindRef.current = null;
    if (kind === 'move') move?.cancel();
    else if (kind === 'resize') resize?.cancel();
    else if (kind === 'rotate') rotate?.cancel();
    else if (kind === 'insert') insert?.cancel();
    else if (kind === 'area') areaSelect?.cancel();
  }, [move, resize, rotate, insert, areaSelect]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
