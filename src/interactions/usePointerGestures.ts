import { useCallback, useRef } from 'react';
import type React from 'react';
import { clientToCanvas } from '../features/viewport/clientToCanvas';
import { cornerResizeHandles, hitCornerHandle } from './gestures/resize/cornerHandles';
import type { UseMoveReturn } from './gestures/move/move';
import type { UseResizeReturn } from './gestures/resize/resize';
import type { ModifierState } from './gestures/types';

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

export interface UsePointerGesturesOptions<TMovePose, TResizePose> {
  /** clientX/Y → world coords. Default: `clientToCanvas` (no pan/zoom). Apps
   *  with a viewport transform compose pan/zoom into this callback. */
  clientToWorld?: (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
  ) => [number, number];

  /** Live move interaction. Omit to disable body-drag dispatch. */
  move?: UseMoveReturn<TMovePose>;

  /** Live resize interaction. Omit to disable handle-drag dispatch. */
  resize?: UseResizeReturn<TResizePose>;

  /** Currently resizable target. Hook computes corner handles, hit-tests, and
   *  dispatches `resize.start(id, anchor, ...)`. Return `null` for none. */
  resizeTarget?: () => { id: string; bounds: Bounds } | null;

  /** Hit-test radius for resize handles, in world pixels. Default 8. */
  handleHitRadius?: number;

  /** Body hit-test for starting a move. Return id(s) to drag, or `null` to
   *  fall through to `onTapEmpty`. */
  hitBody?: (worldX: number, worldY: number) => string | string[] | null;

  /** Called once a body hit has started a drag. Caller typically updates
   *  selection state here. */
  onBodyHit?: (
    ids: string[],
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => void;

  /** Called when the pointer hit neither a handle nor a body. Caller
   *  typically clears selection here. */
  onTapEmpty?: (event: React.PointerEvent<HTMLCanvasElement>) => void;
}

/**
 * Pointer-event dispatcher that wires `useMove` + `useResize` to a canvas.
 * Owns the four `onPointer*` handlers, modifier extraction, world-coord
 * conversion, pointer capture, and the handle-vs-body dispatch decision.
 *
 * Caller still owns selection state, what counts as a body, and which
 * object (if any) is currently resizable.
 *
 * Spread the returned bindings onto a `<canvas>`:
 * ```tsx
 * const bindings = usePointerGestures({ move, resize, hitBody, resizeTarget });
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
    resizeTarget,
    handleHitRadius = 8,
    hitBody,
    onBodyHit,
    onTapEmpty,
  } = options;

  const dragKindRef = useRef<'move' | 'resize' | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const [wx, wy] = clientToWorld(e.currentTarget, e.clientX, e.clientY);

      if (resize && resizeTarget) {
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

      if (move && hitBody) {
        const hit = hitBody(wx, wy);
        if (hit !== null) {
          const ids = Array.isArray(hit) ? hit : [hit];
          dragKindRef.current = 'move';
          e.currentTarget.setPointerCapture(e.pointerId);
          onBodyHit?.(ids, e);
          move.start({
            ids,
            worldX: wx,
            worldY: wy,
            clientX: e.clientX,
            clientY: e.clientY,
          });
          return;
        }
      }

      onTapEmpty?.(e);
    },
    [
      clientToWorld,
      move,
      resize,
      resizeTarget,
      handleHitRadius,
      hitBody,
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
