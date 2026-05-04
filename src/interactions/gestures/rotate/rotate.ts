import { useCallback, useMemo, useRef, useState } from 'react';
import { createTransformOp } from '../../../core/ops/transform';
import type { Op } from '../../../core/ops/types';
import { dispatchApplyBatch } from '../../../core/applyOps';
import type { RotateAdapter } from '../../../core/adapters/types';
import type {
  GestureContext,
  ModifierState,
  ResizePose,
  RotateBehavior,
  RotateOverlay,
  RotatedPose,
} from '../types';
import { aabbCenter } from './geometry';
import { rotationHandle, DEFAULT_ROTATION_HANDLE_DISTANCE } from './handle';
import type { DebugSink } from '../../../debug/types';

const LERP = 0.35;

/** Project a TPose to its `{x, y, width, height, rotation}` view. Defaults to
 *  the identity for `RotatedPose`. Override for non-rect rotated poses. */
export interface RotateGeometry<TPose> {
  getRotatedBounds(pose: TPose): RotatedPose;
  /** Write a new rotation back into the pose; bounds stay the same. */
  withRotation(pose: TPose, rotation: number): TPose;
}

const ROTATED_POSE_GEOMETRY: RotateGeometry<RotatedPose> = {
  getRotatedBounds: (p) => p,
  withRotation: (p, rotation) => ({ ...p, rotation }),
};

/** Arguments passed to `start()` when initiating a rotate gesture. */
export interface RotateStartArgs {
  id: string;
  worldX: number;
  worldY: number;
}

/** Arguments passed to `move()` on each pointer-move during a live gesture. */
export interface RotateMoveArgs {
  worldX: number;
  worldY: number;
  modifiers: ModifierState;
}

/** Options for `useRotate`. */
export interface UseRotateOptions<TPose> {
  /** Behaviors are typed against the pose shape; the kit ships none yet
   *  (rotation snap behaviors are deferred). For non-rect TPose, behaviors
   *  are typed `never` until you supply a `geometry`. */
  behaviors?: TPose extends RotatedPose ? RotateBehavior<TPose>[] : never;
  rotateLabel?: string;
  /** Reserved; rotate is never transient in practice. Ignored. */
  transient?: boolean;
  onGestureStart?: (id: string) => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Project pose ↔ rotated bounds. Defaults to the identity for
   *  `RotatedPose`. Required for non-rect TPose (e.g. a rotated path). */
  geometry?: RotateGeometry<TPose>;
  /** Optional debug sink. When supplied, records the rotation-handle
   *  position + circular hitbox at gesture start. Tree-shakes via
   *  optional-chain when omitted. */
  debug?: DebugSink;
  /** World-pixel distance from the AABB top edge to the rotation handle.
   *  Used for debug-recording the handle position. Default
   *  `DEFAULT_ROTATION_HANDLE_DISTANCE`. */
  rotationHandleDistance?: number;
  /** Hit-test radius for the rotation handle, in screen pixels. Used for
   *  the recorded debug hitbox circle. Default `8`. */
  handleHitRadius?: number;
}

/** Return shape of `useRotate`: lifecycle methods and a live overlay snapshot. */
export interface RotateController<TObject extends { id: string }, TPose> {
  start(args: RotateStartArgs): void;
  move(args: RotateMoveArgs): boolean;
  end(): void;
  cancel(): void;
  isActive(): boolean;
  overlay: RotateOverlay<TPose> | null;
  /** The adapter passed in. Exposed for symmetry with move/resize. */
  adapter: RotateAdapter<TObject, TPose>;
}

interface State<TPose> {
  active: boolean;
  id: string | null;
  originPose: TPose | null;
  /** Center of the unrotated AABB at gesture start (rotation pivot). */
  pivot: { x: number; y: number };
  /** Rotation at gesture start. */
  originRotation: number;
  /** Pointer angle around `pivot` at gesture start. */
  startPointerAngle: number;
  ctx: GestureContext<TPose> | null;
  lastRotation: number;
}

// NOTE (v1 limitation): when a rotated object is resized, the resize math
// treats the AABB as the resize target — non-intuitive behavior on rotated
// objects. Resize-in-rotated-frame is explicitly out of scope for v1.

/** Pointer-driven rotation interaction. Pivot is the AABB center; the
 *  rotation delta is the change in pointer angle around that pivot. Single
 *  TransformOp on commit. */
export function useRotate<TObject extends { id: string }, TPose>(
  adapter: RotateAdapter<TObject, TPose>,
  options: UseRotateOptions<TPose> = {},
): RotateController<TObject, TPose> {
  const {
    behaviors = [] as RotateBehavior<RotatedPose>[],
    rotateLabel = 'Rotate',
    onGestureStart,
    onGestureEnd,
    geometry = ROTATED_POSE_GEOMETRY as unknown as RotateGeometry<TPose>,
    debug,
    rotationHandleDistance = DEFAULT_ROTATION_HANDLE_DISTANCE,
    handleHitRadius = 8,
  } = options as UseRotateOptions<TPose> & {
    behaviors?: RotateBehavior<RotatedPose>[];
  };

  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  // Latest-value refs so controller methods stay referentially stable.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const rotateLabelRef = useRef(rotateLabel);
  rotateLabelRef.current = rotateLabel;
  const onGestureStartRef = useRef(onGestureStart);
  onGestureStartRef.current = onGestureStart;
  const onGestureEndRef = useRef(onGestureEnd);
  onGestureEndRef.current = onGestureEnd;
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const rotationHandleDistanceRef = useRef(rotationHandleDistance);
  rotationHandleDistanceRef.current = rotationHandleDistance;
  const handleHitRadiusRef = useRef(handleHitRadius);
  handleHitRadiusRef.current = handleHitRadius;

  const stateRef = useRef<State<TPose>>({
    active: false,
    id: null,
    originPose: null,
    pivot: { x: 0, y: 0 },
    originRotation: 0,
    startPointerAngle: 0,
    ctx: null,
    lastRotation: 0,
  });

  const [overlay, setOverlay] = useState<RotateOverlay<TPose> | null>(null);

  const cleanup = useCallback(() => {
    stateRef.current.active = false;
    stateRef.current.id = null;
    stateRef.current.originPose = null;
    stateRef.current.ctx = null;
    setOverlay(null);
  }, []);

  const start = useCallback((args: RotateStartArgs) => {
    const adapter = adapterRef.current;
    const geom = geometryRef.current;
    const originPose = adapter.getPose(args.id);
    const rb = geom.getRotatedBounds(originPose);
    const pivot = aabbCenter(rb);
    const startPointerAngle = Math.atan2(args.worldY - pivot.y, args.worldX - pivot.x);

    const ctx: GestureContext<TPose> = {
      draggedIds: [args.id],
      origin: new Map([[args.id, originPose]]),
      current: new Map([[args.id, originPose]]),
      snap: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      pointer: { worldX: args.worldX, worldY: args.worldY, clientX: 0, clientY: 0 },
      adapter: adapter as unknown as GestureContext<TPose>['adapter'],
      scratch: {},
    };
    stateRef.current = {
      active: true,
      id: args.id,
      originPose,
      pivot,
      originRotation: rb.rotation,
      startPointerAngle,
      ctx,
      lastRotation: rb.rotation,
    };
    for (const b of behaviorsRef.current)
      (b as RotateBehavior<RotatedPose>).onStart?.(ctx as unknown as GestureContext<RotatedPose>);
    onGestureStartRef.current?.(args.id);
    // Debug: record rotation handle position + hitbox.
    const dbg = debugRef.current;
    if (dbg) {
      const h = rotationHandle(rb, rotationHandleDistanceRef.current);
      const r = handleHitRadiusRef.current;
      dbg.recordHandle(args.id, { x: h.cx, y: h.cy }, 'rotation');
      dbg.recordHitbox(args.id, 'rotation', { kind: 'circle', cx: h.cx, cy: h.cy, r });
    }
    setOverlay({ id: args.id, currentPose: originPose, targetPose: originPose, originPose });
  }, []);

  const move = useCallback((args: RotateMoveArgs): boolean => {
    const s = stateRef.current;
    if (!s.active || !s.ctx || s.originPose === null || s.id === null) return false;

    const geom = geometryRef.current;
    s.ctx.modifiers = args.modifiers;
    s.ctx.pointer = { worldX: args.worldX, worldY: args.worldY, clientX: 0, clientY: 0 };

    const pointerAngle = Math.atan2(args.worldY - s.pivot.y, args.worldX - s.pivot.x);
    const delta = pointerAngle - s.startPointerAngle;
    let proposedRotation = s.originRotation + delta;
    let proposedPose = geom.withRotation(s.originPose, proposedRotation);

    const ctxAsRot = s.ctx as unknown as GestureContext<RotatedPose>;
    for (const b of behaviorsRef.current) {
      const r = (b as RotateBehavior<RotatedPose>).onMove?.(ctxAsRot, {
        pose: proposedPose as unknown as RotatedPose,
        rotation: proposedRotation,
      });
      if (!r) continue;
      if (r.pose !== undefined) {
        proposedPose = r.pose as unknown as TPose;
        proposedRotation = (r.pose as RotatedPose).rotation;
      }
    }

    s.ctx.current = new Map([[s.id, proposedPose]]);

    // Lerp the visible pose toward the target, in angle space (so going past
    // ±π wraps cleanly).
    const last = s.lastRotation;
    const lerped = last + shortestAngleDelta(last, proposedRotation) * LERP;
    s.lastRotation = lerped;
    const currentPose = geom.withRotation(s.originPose, lerped);

    setOverlay({
      id: s.id,
      currentPose,
      targetPose: proposedPose,
      originPose: s.originPose,
    });
    return true;
  }, []);

  const end = useCallback(() => {
    const s = stateRef.current;
    const adapter = adapterRef.current;
    const rotateLabel = rotateLabelRef.current;
    const onGestureEnd = onGestureEndRef.current;
    if (!s.active || !s.ctx || s.originPose === null || s.id === null) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const geom = geometryRef.current;
    const ctx = s.ctx;
    const targetPose = ctx.current.get(s.id) ?? s.originPose;
    const targetRotation = geom.getRotatedBounds(targetPose).rotation;
    const moved = targetRotation !== s.originRotation;

    let ops: Op[] | null | undefined;
    for (const b of behaviorsRef.current) {
      const r = (b as RotateBehavior<RotatedPose>).onEnd?.(
        ctx as unknown as GestureContext<RotatedPose>,
      );
      if (r === undefined) continue;
      ops = r;
      break;
    }
    if (ops === null) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    if (ops === undefined) {
      if (!moved) {
        cleanup();
        onGestureEnd?.(false);
        return;
      }
      ops = [
        createTransformOp<TPose>({
          id: s.id,
          from: s.originPose,
          to: targetPose,
          label: rotateLabel,
        }),
      ];
    }
    if (ops.length > 0) {
      dispatchApplyBatch(adapter, ops, ops[0].label ?? rotateLabel);
    }
    cleanup();
    onGestureEnd?.(true);
  }, [cleanup]);

  const cancel = useCallback(() => {
    cleanup();
    onGestureEndRef.current?.(false);
  }, [cleanup]);

  const isActive = useCallback(() => stateRef.current.active, []);

  // Stable controller identity — see useMove for rationale.
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const controller = useMemo<RotateController<TObject, TPose>>(() => ({
    start, move, end, cancel, isActive,
    get overlay() { return overlayRef.current; },
    get adapter() { return adapterRef.current; },
  }), [start, move, end, cancel, isActive]);
  return controller;
}

/** Difference `to - from` normalized to `[-π, π]` so lerping wraps correctly. */
function shortestAngleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Re-export so call-sites don't reach into a sibling file when the type is
// useful in their TPose mapping.
export type { ResizePose };
