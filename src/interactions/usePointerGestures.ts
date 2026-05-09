import { useCallback, useRef } from 'react';
import type React from 'react';
import { clientToCanvas } from '../core/viewport/clientToCanvas';
import type { NodeId } from '../core/scene/types';
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
import { rotatePoint } from './gestures/rotate/geometry';
import type { ModifierState } from './gestures/types';
import type { SelectionApi } from '../features/selection/useSelection';
import type { View } from '../core/viewport/view';
import type { DebugSink, HitShape } from '../debug/types';
import { pickTopMostHit } from '../tools/builtin/pickTopMostHit';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** Pointer event handlers ready to spread onto a `<canvas>`. */
export interface PointerGestureBindings {
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onLostPointerCapture: (e: React.PointerEvent<HTMLCanvasElement>) => void;
}

/** Context object passed to body-hit / tap-empty callbacks. */
export interface PointerGestureCallbackCtx {
  event: React.PointerEvent<HTMLCanvasElement>;
  worldX: number;
  worldY: number;
  modifiers: ModifierState;
}

/** Options for `usePointerGestures` — wires move/resize/rotate/insert/area-select controllers into a single canvas. */
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
  tool?: 'select' | 'insert' | 'none';

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
  resizeTarget?: () => { id: string; bounds: Bounds; rotation?: number } | null;

  /** Hit-test radius for resize/rotation handles, in **screen** pixels.
   *  Divided by `view.scale` (via `getView`) at compare time so the hit
   *  area matches the visually rendered handle size under zoom.
   *  Default 8. */
  handleHitRadius?: number;

  /** Returns the current view. Used to convert `handleHitRadius` (screen px)
   *  into world units at hit-test time. Defaults to identity (scale=1) so
   *  legacy callers retain world-px semantics until they wire a view. */
  getView?: () => View;

  /** Body hit-test for starting a move. Return id(s) to drag, or `null` to
   *  fall through to `onTapEmpty`. */
  pickEvery?: (worldX: number, worldY: number) => string | string[] | null;

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

  /** Optional debug sink for the overlay subsystem. When supplied, body
   *  hit-test results record one `recordHitbox(id, 'body', rect)` per id
   *  that `pickEvery` returns — visualises which body shapes the kit
   *  evaluated as hit. Tree-shakes when omitted (optional-chain). */
  debug?: DebugSink;
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
 * const bindings = usePointerGestures({ move, resize, pickEvery, selection });
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
    getView,
    rotationHandleDistance = DEFAULT_ROTATION_HANDLE_DISTANCE,
    pickEvery,
    selection,
    boundsOf,
    onBodyHit,
    onTapEmpty,
    debug,
  } = options;

  // Resolve resizeTarget: explicit > selection-derived
  const explicitResizeTarget = options.resizeTarget;
  const resizeTarget = useCallback((): { id: string; bounds: Bounds; rotation?: number } | null => {
    if (explicitResizeTarget) return explicitResizeTarget();
    if (selection && boundsOf) {
      const ids = selection.get();
      if (ids.length !== 1) return null;
      const b = boundsOf(ids[0]);
      if (!b) return null;
      const rotation = (b as Bounds & { rotation?: number }).rotation;
      return { id: ids[0], bounds: b, rotation };
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

  // Document-level pointerup/pointercancel backstop. React's synthetic
  // onPointerUp on the canvas only fires when the canvas is still the event
  // target — if pointer capture is lost mid-drag (canvas remount, OS-level
  // capture loss, release outside the window), pointerup lands on document
  // instead. Attached on gesture start, detached on gesture end. Both the
  // React handler and these may fire; endActiveGesture is idempotent.
  const docListenersRef = useRef<{ up: (e: PointerEvent) => void; cancel: (e: PointerEvent) => void } | null>(null);
  // Forward ref so listeners (created on gesture start) can call the latest
  // endActiveGesture without re-binding when its identity changes.
  const endActiveGestureRef = useRef<((mode: 'commit' | 'cancel') => void) | null>(null);

  const detachDocListeners = useCallback(() => {
    const ls = docListenersRef.current;
    if (!ls) return;
    document.removeEventListener('pointerup', ls.up);
    document.removeEventListener('pointercancel', ls.cancel);
    docListenersRef.current = null;
  }, []);

  const attachDocListeners = useCallback(() => {
    if (docListenersRef.current) return;
    const up = () => endActiveGestureRef.current?.('commit');
    const cancel = () => endActiveGestureRef.current?.('cancel');
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    docListenersRef.current = { up, cancel };
  }, []);

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
      const viewScale = getView ? getView().scale : 1;
      const radiusWorld = handleHitRadius / viewScale;

      if (rotate) {
        const target = rotateTarget();
        if (target) {
          const handle = rotationHandle(
            { ...target.bounds, rotation: target.rotation ?? 0 },
            rotationHandleDistance,
          );
          if (hitRotationHandle(handle, wx, wy, radiusWorld)) {
            dragKindRef.current = 'rotate';
            e.currentTarget.setPointerCapture(e.pointerId);
            attachDocListeners();
            rotate.start({ id: target.id, worldX: wx, worldY: wy });
            return;
          }
        }
      }

      if (resize) {
        const target = resizeTarget();
        if (target) {
          const rot = target.rotation ?? 0;
          const cx = target.bounds.x + target.bounds.width / 2;
          const cy = target.bounds.y + target.bounds.height / 2;
          for (const h of cornerResizeHandles(target.bounds)) {
            const center = rot === 0
              ? { x: h.cx, y: h.cy }
              : rotatePoint(h.cx, h.cy, cx, cy, rot);
            const rotatedHandle = { cx: center.x, cy: center.y, anchor: h.anchor };
            if (hitCornerHandle(rotatedHandle, wx, wy, radiusWorld)) {
              dragKindRef.current = 'resize';
              e.currentTarget.setPointerCapture(e.pointerId);
              attachDocListeners();
              resize.start(target.id, h.anchor, wx, wy);
              return;
            }
          }
        }
      }

      if (pickEvery) {
        const hit = pickEvery(wx, wy);
        if (hit !== null) {
          const hitIds = Array.isArray(hit) ? hit : [hit];
          // Record body hitboxes for the overlay. `if (debug)` (not just
          // optional-chain) because we derive a rect via `boundsOf` per id
          // — wrap the derivation so the per-iteration cost is zero when
          // debug is off.
          if (debug && boundsOf) {
            for (const id of hitIds) {
              const b = boundsOf(id);
              if (b) {
                const shape: HitShape = {
                  kind: 'rect', x: b.x, y: b.y, width: b.width, height: b.height,
                };
                debug.recordHitbox(id, 'body', shape);
              }
            }
          }
          // Fire onBodyHit (explicit > selection-default).
          if (onBodyHit) {
            onBodyHit(hitIds, ctx);
          } else if (selection && hitIds.length > 0) {
            // pickTopMostHit collapses parent/child overlap so a click
            // inside a container's child selects the child, not the
            // container. See `pickTopMostHit` for the full rule set.
            const top = pickTopMostHit(hitIds, move?.adapter ?? null) ?? hitIds[0];
            selection.applyClick(top as NodeId, modifiers);
          }
          // Now decide what to drag. With selection, drag the post-click
          // selection (so click-on-unselected promotes-then-drags). Without,
          // fall back to dragging the hit ids.
          if (move) {
            const dragIds = selection ? selection.get() : hitIds;
            if (dragIds.length > 0) {
              dragKindRef.current = 'move';
              e.currentTarget.setPointerCapture(e.pointerId);
            attachDocListeners();
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
            attachDocListeners();
        insert.start(wx, wy, modifiers);
        return;
      }
      if (tool === 'select' && areaSelect) {
        dragKindRef.current = 'area';
        e.currentTarget.setPointerCapture(e.pointerId);
            attachDocListeners();
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
      getView,
      pickEvery,
      boundsOf,
      selection,
      onBodyHit,
      onTapEmpty,
      debug,
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

  const endActiveGesture = useCallback(
    (mode: 'commit' | 'cancel') => {
      const kind = dragKindRef.current;
      if (!kind) {
        detachDocListeners();
        debug?.clearSnap();
        return;
      }
      dragKindRef.current = null;
      detachDocListeners();
      const ctl =
        kind === 'move' ? move
        : kind === 'resize' ? resize
        : kind === 'rotate' ? rotate
        : kind === 'insert' ? insert
        : kind === 'area' ? areaSelect
        : null;
      if (!ctl) return;
      if (mode === 'commit') ctl.end();
      else ctl.cancel();
      // Snap candidates persist across renders within a gesture and clear
      // here at the end so the overlay drops them after pointer release.
      debug?.clearSnap();
    },
    [move, resize, rotate, insert, areaSelect, detachDocListeners, debug],
  );
  endActiveGestureRef.current = endActiveGesture;

  const onPointerUp = useCallback(() => endActiveGesture('commit'), [endActiveGesture]);
  const onPointerCancel = useCallback(() => endActiveGesture('cancel'), [endActiveGesture]);

  // `lostpointercapture` used to be our backstop for "user released outside
  // window," but its ordering vs `pointerup` is not reliable: when a mid-drag
  // re-render drops implicit capture, `lostpointercapture` fires in a separate
  // macrotask BEFORE `pointerup`, racing the gesture's own commit and causing
  // snap-backs. The replacement is document-level pointerup/pointercancel
  // listeners attached on gesture start (see `attachDocListeners`), which
  // catch off-canvas releases without depending on capture being intact.
  // We still subscribe to lostpointercapture (no-op handler kept for symmetry
  // with the bindings shape; React requires the handler to be present for
  // attachment to bubble correctly when consumers add their own).
  const onLostPointerCapture = useCallback(() => {}, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture };
}
