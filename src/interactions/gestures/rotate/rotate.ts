import { useCallback, useMemo, useRef, useState } from 'react';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { RotateAdapter } from 'core/adapters/types';
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

/** Shift-snap quantum: 15° in radians. Standard Illustrator/Figma convention. */
const SNAP_STEP = Math.PI / 12;

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
  /** Single-id form (kept for back-compat). */
  id?: string;
  /** Multi-id form. When set, takes precedence over `id`. */
  ids?: string[];
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
  /** Multi-selection pivot mode. Default `'union'`.
   *  - `'each'`: each item rotates around its own center.
   *  - `'union'`: each item rotates around the selection's union center;
   *    item centers orbit the union center while also gaining the same
   *    rotation delta.
   *  Has no effect on single-id gestures. */
  pivot?: 'each' | 'union';
}

/** Return shape of `useRotate`: lifecycle methods and a live overlay snapshot. */
export interface RotateController<TNode extends { id: string }, TPose> {
  start(args: RotateStartArgs): void;
  move(args: RotateMoveArgs): boolean;
  end(): void;
  cancel(): void;
  isActive(): boolean;
  overlay: RotateOverlay<TPose> | null;
  /** The adapter passed in. Exposed for symmetry with move/resize. */
  adapter: RotateAdapter<TNode, TPose>;
}

interface State<TPose> {
  active: boolean;
  ids: string[];
  /** Map id → origin pose at gesture start. */
  originPoses: Map<string, TPose>;
  /** Map id → origin AABB center. */
  originCenters: Map<string, { x: number; y: number }>;
  /** Map id → origin rotation. */
  originRotations: Map<string, number>;
  /** Pivot used to convert pointer angle to rotation delta. For
   *  `pivot: 'union'` this is the union center; for `'each'` it's the same
   *  union center — the pointer-angle math should be stable regardless of
   *  mode. */
  rotationPivot: { x: number; y: number };
  /** Pointer angle around `rotationPivot` at gesture start. */
  startPointerAngle: number;
  ctx: GestureContext<TPose> | null;
  /** Last applied delta (for lerping the overlay). */
  lastDelta: number;
}

// NOTE (v1 limitation): when a rotated object is resized, the resize math
// treats the AABB as the resize target — non-intuitive behavior on rotated
// objects. Resize-in-rotated-frame is explicitly out of scope for v1.

/** Pointer-driven rotation interaction. Pivot is the AABB center; the
 *  rotation delta is the change in pointer angle around that pivot. Single
 *  TransformOp on commit. */
export function useRotate<TNode extends { id: string }, TPose>(
  adapter: RotateAdapter<TNode, TPose>,
  options: UseRotateOptions<TPose> = {},
): RotateController<TNode, TPose> {
  const {
    behaviors = [] as RotateBehavior<RotatedPose>[],
    rotateLabel = 'Rotate',
    onGestureStart,
    onGestureEnd,
    geometry = ROTATED_POSE_GEOMETRY as unknown as RotateGeometry<TPose>,
    debug,
    rotationHandleDistance = DEFAULT_ROTATION_HANDLE_DISTANCE,
    handleHitRadius = 8,
    pivot = 'union',
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
  const pivotRef = useRef(pivot);
  pivotRef.current = pivot;

  const stateRef = useRef<State<TPose>>({
    active: false,
    ids: [],
    originPoses: new Map(),
    originCenters: new Map(),
    originRotations: new Map(),
    rotationPivot: { x: 0, y: 0 },
    startPointerAngle: 0,
    ctx: null,
    lastDelta: 0,
  });

  const [overlay, setOverlay] = useState<RotateOverlay<TPose> | null>(null);

  const cleanup = useCallback(() => {
    stateRef.current = {
      active: false,
      ids: [],
      originPoses: new Map(),
      originCenters: new Map(),
      originRotations: new Map(),
      rotationPivot: { x: 0, y: 0 },
      startPointerAngle: 0,
      ctx: null,
      lastDelta: 0,
    };
    setOverlay(null);
  }, []);

  const start = useCallback((args: RotateStartArgs) => {
    const adapter = adapterRef.current;
    const geom = geometryRef.current;
    const ids = args.ids ?? (args.id != null ? [args.id] : []);
    if (ids.length === 0) return;

    const originPoses = new Map<string, TPose>();
    const originCenters = new Map<string, { x: number; y: number }>();
    const originRotations = new Map<string, number>();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const p = adapter.getPose(id);
      originPoses.set(id, p);
      const rb = geom.getRotatedBounds(p);
      const c = aabbCenter(rb);
      originCenters.set(id, c);
      originRotations.set(id, rb.rotation);
      if (rb.x < minX) minX = rb.x;
      if (rb.y < minY) minY = rb.y;
      if (rb.x + rb.width > maxX) maxX = rb.x + rb.width;
      if (rb.y + rb.height > maxY) maxY = rb.y + rb.height;
    }
    const unionCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const startPointerAngle = Math.atan2(args.worldY - unionCenter.y, args.worldX - unionCenter.x);

    const ctx: GestureContext<TPose> = {
      draggedIds: ids,
      origin: new Map(originPoses),
      current: new Map(originPoses),
      snap: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      pointer: { worldX: args.worldX, worldY: args.worldY, clientX: 0, clientY: 0 },
      adapter: adapter as unknown as GestureContext<TPose>['adapter'],
      scratch: {},
    };
    stateRef.current = {
      active: true,
      ids,
      originPoses,
      originCenters,
      originRotations,
      rotationPivot: unionCenter,
      startPointerAngle,
      ctx,
      lastDelta: 0,
    };
    for (const b of behaviorsRef.current)
      (b as RotateBehavior<RotatedPose>).onStart?.(ctx as unknown as GestureContext<RotatedPose>);
    onGestureStartRef.current?.(ids[0]);
    // Debug rec only for single-id starts (the handle is a single-bounds concept).
    const dbg = debugRef.current;
    if (dbg && ids.length === 1) {
      const rb = geom.getRotatedBounds(originPoses.get(ids[0])!);
      const h = rotationHandle(rb, rotationHandleDistanceRef.current);
      const r = handleHitRadiusRef.current;
      dbg.recordHandle(ids[0], { x: h.cx, y: h.cy }, 'rotation');
      dbg.recordHitbox(ids[0], 'rotation', { kind: 'circle', cx: h.cx, cy: h.cy, r });
    }
    // Overlay tracks single-id for now; multi overlay is out of scope here.
    const firstId = ids[0];
    const firstPose = originPoses.get(firstId)!;
    setOverlay({
      id: firstId,
      currentPose: firstPose,
      targetPose: firstPose,
      originPose: firstPose,
    });
  }, []);

  const move = useCallback((args: RotateMoveArgs): boolean => {
    const s = stateRef.current;
    if (!s.active || !s.ctx || s.ids.length === 0) return false;

    const geom = geometryRef.current;
    s.ctx.modifiers = args.modifiers;
    s.ctx.pointer = { worldX: args.worldX, worldY: args.worldY, clientX: 0, clientY: 0 };

    const pointerAngle = Math.atan2(
      args.worldY - s.rotationPivot.y,
      args.worldX - s.rotationPivot.x,
    );
    const delta = pointerAngle - s.startPointerAngle;

    const useUnion = pivotRef.current === 'union' && s.ids.length > 1;
    // No-snap fast path uses a single cos/sin for the whole batch. When
    // shift is held, each item's snapped delta may differ, so cos/sin are
    // recomputed per-id below.
    const shiftHeld = args.modifiers.shift;
    const cos = Math.cos(delta);
    const sin = Math.sin(delta);
    const newCurrent = new Map<string, TPose>();

    for (const id of s.ids) {
      const originPose = s.originPoses.get(id)!;
      const originRotation = s.originRotations.get(id)!;
      let proposedRotation = originRotation + delta;
      if (shiftHeld) {
        // Snap the **final rotation** (not the delta) to the nearest 15°.
        // Each item's origin rotation differs, so this happens per-id.
        proposedRotation = Math.round(proposedRotation / SNAP_STEP) * SNAP_STEP;
      }

      let proposedPose: TPose;
      if (useUnion) {
        // Orbit the item's center around the union center. The bounds
        // (width/height) don't change; only the AABB position shifts so the
        // new center sits at (newCx, newCy). Assumes TPose surfaces x/y/
        // width/height — true for RotatedPose-shaped poses; exotic TPose
        // would need a richer geometry adapter.
        //
        // When shift is held, the orbit must use the **same delta** that
        // produced the snapped rotation — otherwise an item would rotate
        // by, say, 47° while orbiting by 45°, which looks broken.
        const originCenter = s.originCenters.get(id)!;
        let cosI = cos;
        let sinI = sin;
        if (shiftHeld) {
          const itemDelta = proposedRotation - originRotation;
          cosI = Math.cos(itemDelta);
          sinI = Math.sin(itemDelta);
        }
        const ox = originCenter.x - s.rotationPivot.x;
        const oy = originCenter.y - s.rotationPivot.y;
        const newCx = s.rotationPivot.x + ox * cosI - oy * sinI;
        const newCy = s.rotationPivot.y + ox * sinI + oy * cosI;
        const rb = geom.getRotatedBounds(originPose);
        const newX = newCx - rb.width / 2;
        const newY = newCy - rb.height / 2;
        const rotated = geom.withRotation(originPose, proposedRotation);
        proposedPose = { ...(rotated as object), x: newX, y: newY } as TPose;
      } else {
        proposedPose = geom.withRotation(originPose, proposedRotation);
      }

      // Run behaviors per-id (most behaviors target single items).
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

      newCurrent.set(id, proposedPose);
    }
    s.ctx.current = newCurrent;

    // Lerp the overlay (first-id only) toward the target rotation, in angle
    // space (so going past ±π wraps cleanly). Multi overlay is out of scope.
    const firstId = s.ids[0];
    const firstOrigin = s.originPoses.get(firstId)!;
    const firstTarget = newCurrent.get(firstId)!;
    const firstTargetRotation = geom.getRotatedBounds(firstTarget).rotation;
    const firstOriginRotation = s.originRotations.get(firstId)!;
    const lastApplied = firstOriginRotation + s.lastDelta;
    const lerped = lastApplied + shortestAngleDelta(lastApplied, firstTargetRotation) * LERP;
    s.lastDelta = lerped - firstOriginRotation;
    // currentPose: in union mode, also reflect orbit on the first item.
    let currentPose: TPose;
    if (useUnion) {
      const originCenter = s.originCenters.get(firstId)!;
      const lerpedDelta = lerped - firstOriginRotation;
      const lc = Math.cos(lerpedDelta);
      const ls = Math.sin(lerpedDelta);
      const ox = originCenter.x - s.rotationPivot.x;
      const oy = originCenter.y - s.rotationPivot.y;
      const newCx = s.rotationPivot.x + ox * lc - oy * ls;
      const newCy = s.rotationPivot.y + ox * ls + oy * lc;
      const rb = geom.getRotatedBounds(firstOrigin);
      const rotated = geom.withRotation(firstOrigin, lerped);
      currentPose = { ...(rotated as object), x: newCx - rb.width / 2, y: newCy - rb.height / 2 } as TPose;
    } else {
      currentPose = geom.withRotation(firstOrigin, lerped);
    }

    setOverlay({
      id: firstId,
      currentPose,
      targetPose: firstTarget,
      originPose: firstOrigin,
    });
    return true;
  }, []);

  const end = useCallback(() => {
    const s = stateRef.current;
    const adapter = adapterRef.current;
    const rotateLabel = rotateLabelRef.current;
    const onGestureEnd = onGestureEndRef.current;
    if (!s.active || !s.ctx || s.ids.length === 0) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const geom = geometryRef.current;
    const ctx = s.ctx;
    let moved = false;
    const defaultOps: Op[] = [];
    for (const id of s.ids) {
      const originPose = s.originPoses.get(id)!;
      const targetPose = ctx.current.get(id) ?? originPose;
      const originRotation = s.originRotations.get(id)!;
      const targetRotation = geom.getRotatedBounds(targetPose).rotation;
      if (targetRotation !== originRotation) moved = true;
      defaultOps.push(
        createTransformOp<TPose>({
          id,
          from: originPose,
          to: targetPose,
          label: rotateLabel,
        }),
      );
    }

    let finalOps: Op[] | null | undefined;
    for (const b of behaviorsRef.current) {
      const r = (b as RotateBehavior<RotatedPose>).onEnd?.(
        ctx as unknown as GestureContext<RotatedPose>,
      );
      if (r === undefined) continue;
      finalOps = r;
      break;
    }
    if (finalOps === null) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const useOps = finalOps ?? (moved ? defaultOps : []);
    if (useOps.length > 0) {
      dispatchApplyBatch(adapter, useOps, useOps[0].label ?? rotateLabel);
    }
    cleanup();
    onGestureEnd?.(useOps.length > 0);
  }, [cleanup]);

  const cancel = useCallback(() => {
    cleanup();
    onGestureEndRef.current?.(false);
  }, [cleanup]);

  const isActive = useCallback(() => stateRef.current.active, []);

  // Stable controller identity — see useMove for rationale.
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const controller = useMemo<RotateController<TNode, TPose>>(() => ({
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
