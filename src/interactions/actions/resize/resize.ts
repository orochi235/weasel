import { useCallback, useMemo, useRef, useState } from 'react';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { ResizeAdapter } from 'core/adapters/types';
import type {
  GestureContext,
  ModifierState,
  PointSnapBehavior,
  PointSnapContext,
  PointSnapResult,
  ResizeAnchor,
  ResizeBehavior,
  ResizeOverlay,
  ResizePose,
} from '../../gestures/types';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from './geometry';
import { cornerResizeHandles, fixedCornerOf } from './cornerHandles';
import { rotatePoint } from '../rotate/geometry';
import type { DebugSink } from '../../../debug/types';

const defaultTranslate = <TPose>(p: TPose, dx: number, dy: number): TPose =>
  ({ ...(p as object), x: (p as { x: number }).x + dx, y: (p as { y: number }).y + dy } as TPose);

const LERP = 0.35;

/** Options for `useResize`. */
export interface UseResizeOptions<TPose> {
  /** Behaviors are rect-typed: they read/write `{x,y,width,height}`. When
   *  `TPose` is non-rect, pass `geometry` to project pose↔bounds; behaviors
   *  in that case are typed `never` because none in the kit's library would
   *  understand the pose shape. */
  behaviors?: TPose extends ResizePose ? ResizeBehavior<TPose>[] : never;
  resizeLabel?: string;
  /** Reserved; resize is never transient in practice. Ignored. */
  transient?: boolean;
  onGestureStart?: (id: string) => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Optional: expand the incoming id into leaf ids before pose lookups.
   *  Mirrors `useMove`'s `expandIds`. Used for group expansion: when the
   *  gesture is started against a group id, the kit
   *  resizes by computing the union AABB of the leaves' origin bounds,
   *  running the compute pipeline on that union rect (group bounds), and
   *  remapping each leaf via `geometry.remapBounds(leaf, originGroupBounds,
   *  proposedGroupBounds)`.
   *
   *  When `expandIds` is omitted or returns the original single id, the
   *  gesture takes the single-leaf path (the leaf's own bounds become both
   *  the origin and the target of the same `remapBounds` call).
   *
   *  Called once at `start()`. Returning `[]` aborts the gesture cleanly. */
  expandIds?: (ids: string[]) => string[];
  /** Projection from `TPose` to bounds and back. Defaults to rect identity
   *  when `TPose extends ResizePose`. Required for non-rect TPose (Path,
   *  polygon, etc.). */
  geometry?: PoseDescriptor<TPose>;
  /** Behaviors that operate on world-space anchor points. Fire after
   *  `behaviors[]` (bounds-frame). Each behavior receives a `PointSnapContext`
   *  with world-space frame points and returns at most one `PointSnapResult`;
   *  the hook back-solves the local pose so the chosen frame's world point
   *  lands on the snap target. First non-null result wins. */
  pointSnapBehaviors?: TPose extends ResizePose ? PointSnapBehavior<TPose>[] : never;
  /** Optional debug sink. When supplied, records corner-handle positions +
   *  circular hitboxes when the gesture starts (covers the on-screen
   *  handles for the resized target). Tree-shakes via optional-chain
   *  when omitted. */
  debug?: DebugSink;
  /** Hit-test radius for corner handles, in screen pixels. Used purely for
   *  the recorded debug hitbox circle radius — does not affect actual hit
   *  math (which lives in `usePointerGestures`). Default `8`. */
  handleHitRadius?: number;
}

/** Return shape of `useResize`: lifecycle methods plus a live overlay snapshot. */
export interface ResizeController<TNode extends { id: string }, TPose> {
  start(id: string, anchor: ResizeAnchor, worldX: number, worldY: number): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  isResizing: boolean;
  overlay: ResizeOverlay<TPose> | null;
  /** The adapter passed in. Exposed so downstream consumers (notably
   *  `<Canvas>`) can derive default `boundsOf` without taking the adapter
   *  as a separate prop. */
  adapter: ResizeAdapter<TNode, TPose>;
}

interface State<TPose> {
  active: boolean;
  /** The id passed to `start()`. For a group resize this is the group id. */
  id: string | null;
  anchor: ResizeAnchor;
  /** Origin pose of the group/leaf being resized. */
  originPose: TPose | null;
  /** Bounds projection of `originPose`. Threaded through anchor math. */
  originBounds: ResizePose | null;
  start: { worldX: number; worldY: number };
  ctx: GestureContext<TPose> | null;
  lastBounds: ResizePose | null;
  /** Non-null only when expandIds produced a group expansion (>1 leaf). */
  leafIds: string[] | null;
  leafOrigins: Map<string, TPose> | null;
  /** Last proposed per-leaf poses (set during move). Used by end() to
   *  emit one transform op per leaf without recomputing the projection. */
  leafTargets: Map<string, TPose> | null;
  /** Rotation captured at gesture start. 0 means unrotated short-circuit. */
  originRotation: number;
  /** World-space position of the diagonally opposite corner at start. */
  fixedWorld: { x: number; y: number };
}

/** Compute the union AABB of N bounds. Caller guarantees `bounds.length >= 1`. */
function computeUnionBounds(bounds: ResizePose[]): ResizePose {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of bounds) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ----- point-snap back-solve helpers -----

function buildPointSnapContext<TPose extends ResizePose>(
  pose: TPose,
  rotation: number,
  anchor: ResizeAnchor,
  modifiers: ModifierState,
): PointSnapContext<TPose> {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;

  const tl = rotatePoint(pose.x, pose.y, cx, cy, rotation);
  const tr = rotatePoint(pose.x + pose.width, pose.y, cx, cy, rotation);
  const br = rotatePoint(pose.x + pose.width, pose.y + pose.height, cx, cy, rotation);
  const bl = rotatePoint(pose.x, pose.y + pose.height, cx, cy, rotation);

  let draggedCorner: { worldX: number; worldY: number } | null = null;
  let fixedCorner: { worldX: number; worldY: number } | null = null;

  if (anchor.x !== 'free' && anchor.y !== 'free') {
    // anchor marks the FIXED corner; dragged is diagonally opposite.
    const fixedPt =
      anchor.x === 'min' && anchor.y === 'min' ? tl :
      anchor.x === 'max' && anchor.y === 'min' ? tr :
      anchor.x === 'max' && anchor.y === 'max' ? br : bl;
    const draggedPt =
      anchor.x === 'min' && anchor.y === 'min' ? br :
      anchor.x === 'max' && anchor.y === 'min' ? bl :
      anchor.x === 'max' && anchor.y === 'max' ? tl : tr;
    fixedCorner = { worldX: fixedPt.x, worldY: fixedPt.y };
    draggedCorner = { worldX: draggedPt.x, worldY: draggedPt.y };
  }

  return {
    draggedCorner,
    fixedCorner,
    center: { worldX: cx, worldY: cy },
    origin: { worldX: tl.x, worldY: tl.y },
    rotation,
    anchor,
    proposed: pose,
    modifiers,
  };
}

function applyPointSnap<TPose extends ResizePose>(
  pose: TPose,
  rotation: number,
  result: PointSnapResult,
  ctx: PointSnapContext<TPose>,
): TPose {
  if (result.frame === 'center') {
    const dx = result.worldX - ctx.center.worldX;
    const dy = result.worldY - ctx.center.worldY;
    return { ...pose, x: pose.x + dx, y: pose.y + dy };
  }

  if (result.frame === 'origin') {
    const dx = result.worldX - ctx.origin.worldX;
    const dy = result.worldY - ctx.origin.worldY;
    return { ...pose, x: pose.x + dx, y: pose.y + dy };
  }

  // dragged-corner: pin = fixedCorner, target = snapped dragged corner.
  // fixed-corner:  pin = draggedCorner, target = snapped fixed corner.
  const pin = result.frame === 'dragged-corner' ? ctx.fixedCorner : ctx.draggedCorner;
  if (!pin) return pose; // edge drag — no-op

  const Dx = result.worldX - pin.worldX;
  const Dy = result.worldY - pin.worldY;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  // Project diagonal onto local x-axis (cos, sin) and y-axis (-sin, cos).
  const localW = Dx * cos + Dy * sin;
  const localH = -Dx * sin + Dy * cos;
  const newWidth = Math.abs(localW);
  const newHeight = Math.abs(localH);
  // New center is the midpoint of the two diagonal corners in world space.
  const newCx = (pin.worldX + result.worldX) / 2;
  const newCy = (pin.worldY + result.worldY) / 2;
  return { ...pose, x: newCx - newWidth / 2, y: newCy - newHeight / 2, width: newWidth, height: newHeight };
}

/** Pointer-driven resize interaction with anchor-relative dragging, optional group expansion, and behavior pipeline. */
export function useResize<TNode extends { id: string }, TPose>(
  adapter: ResizeAdapter<TNode, TPose>,
  options: UseResizeOptions<TPose>,
): ResizeController<TNode, TPose> {
  const {
    behaviors = [] as ResizeBehavior<ResizePose>[],
    pointSnapBehaviors = [] as PointSnapBehavior<ResizePose>[],
    resizeLabel = 'Resize',
    onGestureStart,
    onGestureEnd,
    expandIds,
    geometry = RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>,
    debug,
    handleHitRadius = 8,
  } = options as UseResizeOptions<TPose> & {
    behaviors?: ResizeBehavior<ResizePose>[];
    pointSnapBehaviors?: PointSnapBehavior<ResizePose>[];
  };

  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  const pointSnapBehaviorsRef = useRef(pointSnapBehaviors);
  pointSnapBehaviorsRef.current = pointSnapBehaviors;
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  // Latest-value refs so controller methods stay referentially stable.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const resizeLabelRef = useRef(resizeLabel);
  resizeLabelRef.current = resizeLabel;
  const onGestureStartRef = useRef(onGestureStart);
  onGestureStartRef.current = onGestureStart;
  const onGestureEndRef = useRef(onGestureEnd);
  onGestureEndRef.current = onGestureEnd;
  const expandIdsRef = useRef(expandIds);
  expandIdsRef.current = expandIds;
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const handleHitRadiusRef = useRef(handleHitRadius);
  handleHitRadiusRef.current = handleHitRadius;

  const stateRef = useRef<State<TPose>>({
    active: false,
    id: null,
    anchor: { x: 'free', y: 'free' },
    originPose: null,
    originBounds: null,
    start: { worldX: 0, worldY: 0 },
    ctx: null,
    lastBounds: null,
    leafIds: null,
    leafOrigins: null,
    leafTargets: null,
    originRotation: 0,
    fixedWorld: { x: 0, y: 0 },
  });

  const [overlay, setOverlay] = useState<ResizeOverlay<TPose> | null>(null);

  const cleanup = useCallback(() => {
    stateRef.current.active = false;
    stateRef.current.id = null;
    stateRef.current.originPose = null;
    stateRef.current.originBounds = null;
    stateRef.current.ctx = null;
    stateRef.current.lastBounds = null;
    stateRef.current.leafIds = null;
    stateRef.current.leafOrigins = null;
    stateRef.current.leafTargets = null;
    stateRef.current.originRotation = 0;
    stateRef.current.fixedWorld = { x: 0, y: 0 };
    setOverlay(null);
  }, []);

  const start = useCallback((id: string, anchor: ResizeAnchor, worldX: number, worldY: number) => {
    const adapter = adapterRef.current;
    const expandIds = expandIdsRef.current;
    const expanded = expandIds ? expandIds([id]) : [id];
    if (expanded.length === 0) {
      stateRef.current.active = false;
      return;
    }

    const geom = geometryRef.current;
    let originPose: TPose;
    let originBounds: ResizePose;
    let leafIds: string[] | null = null;
    let leafOrigins: Map<string, TPose> | null = null;

    if (expanded.length === 1 && expanded[0] === id) {
      originPose = adapter.getPose(id);
      originBounds = geom.getBounds(originPose);
    } else {
      // Group path. `id` is the group id; its leaves carry the poses.
      leafIds = expanded;
      leafOrigins = new Map<string, TPose>();
      const leafBounds: ResizePose[] = [];
      for (const lid of expanded) {
        const lp = adapter.getPose(lid);
        leafOrigins.set(lid, lp);
        leafBounds.push(geom.getBounds(lp));
      }
      originBounds = computeUnionBounds(leafBounds);
      // Synthesize an origin pose for the group from the union rect. The
      // group pose is only used to feed `ctx.origin` / behaviors that
      // operate on rect fields; for non-rect TPose with no behaviors it's
      // never consulted.
      originPose = originBounds as unknown as TPose;
    }

    const originRotation = geom.getRotation?.(originPose) ?? 0;
    const fixedLocal = fixedCornerOf(originBounds, anchor);
    const fixedWorld = originRotation === 0
      ? fixedLocal
      : rotatePoint(
          fixedLocal.x, fixedLocal.y,
          originBounds.x + originBounds.width / 2,
          originBounds.y + originBounds.height / 2,
          originRotation,
        );

    if (leafIds && leafOrigins) {
      const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
      if (isDev) {
        for (const lid of leafIds) {
          const r = geom.getRotation?.(leafOrigins.get(lid)!) ?? 0;
          if (r !== 0) {
            // eslint-disable-next-line no-console
            console.warn(
              'useResize: group resize with rotated leaves is not supported. ' +
              'Falling back to AABB-frame group resize; results will be visually ' +
              'incorrect for rotated leaves.',
            );
            break;
          }
        }
      }
    }

    const ctx: GestureContext<TPose> = {
      draggedIds: [id],
      origin: new Map([[id, originPose]]),
      current: new Map([[id, originPose]]),
      snap: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      pointer: { worldX, worldY, clientX: 0, clientY: 0 },
      adapter: adapter as unknown as GestureContext<TPose>['adapter'],
      scratch: {},
    };
    stateRef.current = {
      active: true,
      id,
      anchor,
      originPose,
      originBounds,
      start: { worldX, worldY },
      ctx,
      lastBounds: originBounds,
      leafIds,
      leafOrigins,
      leafTargets: null,
      originRotation,
      fixedWorld,
    };
    // Debug: record corner-handle positions + hitboxes for the active
    // resize target. Optional-chain — when `debug` is undefined the calls
    // short-circuit and the bundler can DCE the strategy.
    const dbg = debugRef.current;
    if (dbg) {
      const r = handleHitRadiusRef.current;
      for (const h of cornerResizeHandles(originBounds)) {
        dbg.recordHandle(id, { x: h.cx, y: h.cy }, 'corner');
        dbg.recordHitbox(id, 'handle', { kind: 'circle', cx: h.cx, cy: h.cy, r });
      }
    }
    for (const b of behaviorsRef.current) (b as ResizeBehavior<ResizePose>).onStart?.(ctx as unknown as GestureContext<ResizePose>);
    onGestureStartRef.current?.(id);
    setOverlay({ id, currentPose: originPose, targetPose: originPose, anchor });
  }, []);

  const move = useCallback((worldX: number, worldY: number, modifiers: ModifierState): boolean => {
    const s = stateRef.current;
    if (!s.active || !s.ctx || !s.originPose || !s.originBounds || !s.id) return false;

    const geom = geometryRef.current;
    s.ctx.modifiers = modifiers;
    s.ctx.pointer = { worldX, worldY, clientX: 0, clientY: 0 };

    const dx = worldX - s.start.worldX;
    const dy = worldY - s.start.worldY;
    const ob = s.originBounds;

    let proposedBounds: ResizePose;
    if (s.originRotation === 0) {
      // Unrotated path — bit-identical to today.
      let nx = ob.x;
      let ny = ob.y;
      let nw = ob.width;
      let nh = ob.height;
      if (s.anchor.x === 'min') {
        nw = ob.width + dx;
      } else if (s.anchor.x === 'max') {
        nx = ob.x + dx;
        nw = ob.width - dx;
      }
      if (s.anchor.y === 'min') {
        nh = ob.height + dy;
      } else if (s.anchor.y === 'max') {
        ny = ob.y + dy;
        nh = ob.height - dy;
      }
      proposedBounds = { x: nx, y: ny, width: nw, height: nh };
    } else {
      // Rotated path: project drag into local frame.
      const cs = Math.cos(-s.originRotation);
      const sn = Math.sin(-s.originRotation);
      const dxLocal = cs * dx - sn * dy;
      const dyLocal = sn * dx + cs * dy;
      let nx = ob.x;
      let ny = ob.y;
      let nw = ob.width;
      let nh = ob.height;
      if (s.anchor.x === 'min') {
        nw = ob.width + dxLocal;
      } else if (s.anchor.x === 'max') {
        nx = ob.x + dxLocal;
        nw = ob.width - dxLocal;
      }
      if (s.anchor.y === 'min') {
        nh = ob.height + dyLocal;
      } else if (s.anchor.y === 'max') {
        ny = ob.y + dyLocal;
        nh = ob.height - dyLocal;
      }
      proposedBounds = { x: nx, y: ny, width: nw, height: nh };
    }

    // Behaviors operate in bounds-space. For rect TPose, proposed.pose IS
    // the proposed bounds (same shape); behaviors return a TPose with rect
    // fields rewritten, which we read back as bounds.
    const ctxAsRect = s.ctx as unknown as GestureContext<ResizePose>;
    for (const b of behaviorsRef.current) {
      const r = (b as ResizeBehavior<ResizePose>).onMove?.(ctxAsRect, {
        pose: proposedBounds,
        anchor: s.anchor,
      });
      if (!r) continue;
      if (r.pose !== undefined) {
        proposedBounds = {
          x: r.pose.x,
          y: r.pose.y,
          width: r.pose.width,
          height: r.pose.height,
        };
      }
    }

    let proposedPose = geom.remapBounds(s.originPose, s.originBounds, proposedBounds);

    if (s.originRotation !== 0) {
      const newCenterX = proposedBounds.x + proposedBounds.width / 2;
      const newCenterY = proposedBounds.y + proposedBounds.height / 2;
      const newFixedLocal = fixedCornerOf(proposedBounds, s.anchor);
      const newFixedWorld = rotatePoint(
        newFixedLocal.x, newFixedLocal.y,
        newCenterX, newCenterY,
        s.originRotation,
      );
      const correctionX = s.fixedWorld.x - newFixedWorld.x;
      const correctionY = s.fixedWorld.y - newFixedWorld.y;
      const translate = geom.translate ?? defaultTranslate<TPose>;
      proposedPose = translate(proposedPose, correctionX, correctionY);
    }

    // Point-snap behaviors run after the full bounds→pose pipeline (including
    // rotation correction). They receive world-space frame points derived from
    // the fully-corrected proposed pose, and back-solve a new pose directly.
    const psbs = pointSnapBehaviorsRef.current;
    if (psbs.length > 0) {
      const rotation = s.originRotation;
      const poseAsRect = proposedPose as unknown as ResizePose;
      const psCtx = buildPointSnapContext(poseAsRect, rotation, s.anchor, modifiers);
      for (const beh of psbs) {
        const result = (beh as PointSnapBehavior<ResizePose>).onMove(psCtx);
        if (result) {
          const snapped = applyPointSnap(poseAsRect, rotation, result, psCtx);
          proposedPose = snapped as unknown as TPose;
          // Re-derive proposedBounds from the snapped pose so the lerp +
          // overlay pipeline below tracks the snapped geometry instead of
          // the un-snapped local-frame bounds. Without this, the live
          // overlay would render the pre-snap rectangle and only jump to
          // the snapped position after pointer release.
          proposedBounds = geom.getBounds(proposedPose);
          break;
        }
      }
    }

    s.ctx.current = new Map([[s.id, proposedPose]]);

    const last = s.lastBounds ?? ob;
    const lerp = (a: number, b: number) => a + (b - a) * LERP;
    const currentBounds: ResizePose = {
      x: lerp(last.x, proposedBounds.x),
      y: lerp(last.y, proposedBounds.y),
      width: lerp(last.width, proposedBounds.width),
      height: lerp(last.height, proposedBounds.height),
    };
    s.lastBounds = currentBounds;
    let currentPose = geom.remapBounds(s.originPose, s.originBounds, currentBounds);

    if (s.originRotation !== 0) {
      const newCenterX = currentBounds.x + currentBounds.width / 2;
      const newCenterY = currentBounds.y + currentBounds.height / 2;
      const newFixedLocal = fixedCornerOf(currentBounds, s.anchor);
      const newFixedWorld = rotatePoint(
        newFixedLocal.x, newFixedLocal.y,
        newCenterX, newCenterY,
        s.originRotation,
      );
      const correctionX = s.fixedWorld.x - newFixedWorld.x;
      const correctionY = s.fixedWorld.y - newFixedWorld.y;
      const translate = geom.translate ?? defaultTranslate<TPose>;
      currentPose = translate(currentPose, correctionX, correctionY);
    }

    let leafPoses: Map<string, TPose> | undefined;
    if (s.leafIds && s.leafOrigins) {
      leafPoses = new Map<string, TPose>();
      for (const lid of s.leafIds) {
        const lp = s.leafOrigins.get(lid)!;
        leafPoses.set(lid, geom.remapBounds(lp, s.originBounds, proposedBounds));
      }
      s.leafTargets = leafPoses;
    }

    setOverlay({ id: s.id, currentPose, targetPose: proposedPose, anchor: s.anchor, leafPoses });
    return true;
  }, []);

  const end = useCallback(() => {
    const s = stateRef.current;
    const adapter = adapterRef.current;
    const resizeLabel = resizeLabelRef.current;
    const onGestureEnd = onGestureEndRef.current;
    if (!s.active || !s.ctx || !s.originPose || !s.originBounds || !s.id) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const geom = geometryRef.current;
    const ctx = s.ctx;
    const targetPose = ctx.current.get(s.id) ?? s.originPose;
    const targetBounds = geom.getBounds(targetPose);

    const moved =
      targetBounds.x !== s.originBounds.x ||
      targetBounds.y !== s.originBounds.y ||
      targetBounds.width !== s.originBounds.width ||
      targetBounds.height !== s.originBounds.height;

    let ops: Op[] | null | undefined;
    for (const b of behaviorsRef.current) {
      const r = (b as ResizeBehavior<ResizePose>).onEnd?.(ctx as unknown as GestureContext<ResizePose>);
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
      if (s.leafIds && s.leafOrigins) {
        // Group path: emit one transform op per leaf, recomputing per-leaf
        // remapped poses from the final group target so end() doesn't
        // depend on whether move() ran most recently.
        ops = [];
        for (const lid of s.leafIds) {
          const lp = s.leafOrigins.get(lid)!;
          const to = s.leafTargets?.get(lid) ?? geom.remapBounds(lp, s.originBounds, targetBounds);
          ops.push(
            createTransformOp<TPose>({
              id: lid,
              from: lp,
              to,
              label: resizeLabel,
            }),
          );
        }
      } else {
        ops = [
          createTransformOp<TPose>({
            id: s.id,
            from: s.originPose,
            to: targetPose,
            label: resizeLabel,
          }),
        ];
      }
    }
    if (ops.length > 0) {
      dispatchApplyBatch(adapter, ops, ops[0].label ?? resizeLabel);
    }
    cleanup();
    onGestureEnd?.(true);
  }, [cleanup]);

  const cancel = useCallback(() => {
    cleanup();
    onGestureEndRef.current?.(false);
  }, [cleanup]);

  // Stable controller identity — see useMove for rationale.
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const controller = useMemo<ResizeController<TNode, TPose>>(() => ({
    start, move, end, cancel,
    get overlay() { return overlayRef.current; },
    get isResizing() { return overlayRef.current !== null; },
    get adapter() { return adapterRef.current; },
  }), [start, move, end, cancel]);
  return controller;
}
