import { useCallback, useRef, useState } from 'react';
import { createTransformOp } from '../../../core/ops/transform';
import type { Op } from '../../../core/ops/types';
import { dispatchApplyBatch } from '../../../core/applyOps';
import type { ResizeAdapter } from '../../../core/adapters/types';
import type {
  GestureContext,
  ModifierState,
  ResizeAnchor,
  ResizeBehavior,
  ResizeOverlay,
  ResizePose,
} from '../types';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from './geometry';

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
   *  Mirrors `useMove`'s `expandIds`. Used for virtual-group
   *  expansion: when the gesture is started against a group id, the kit
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
}

/** Return shape of `useResize`: lifecycle methods plus a live overlay snapshot. */
export interface ResizeController<TObject extends { id: string }, TPose> {
  start(id: string, anchor: ResizeAnchor, worldX: number, worldY: number): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  isResizing: boolean;
  overlay: ResizeOverlay<TPose> | null;
  /** The adapter passed in. Exposed so downstream consumers (notably
   *  `<Canvas>`) can derive default `boundsOf` without taking the adapter
   *  as a separate prop. */
  adapter: ResizeAdapter<TObject, TPose>;
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

/** Pointer-driven resize interaction with anchor-relative dragging, optional group expansion, and behavior pipeline. */
export function useResize<TObject extends { id: string }, TPose>(
  adapter: ResizeAdapter<TObject, TPose>,
  options: UseResizeOptions<TPose>,
): ResizeController<TObject, TPose> {
  const {
    behaviors = [] as ResizeBehavior<ResizePose>[],
    resizeLabel = 'Resize',
    onGestureStart,
    onGestureEnd,
    expandIds,
    geometry = RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>,
  } = options as UseResizeOptions<TPose> & {
    behaviors?: ResizeBehavior<ResizePose>[];
  };

  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

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
    setOverlay(null);
  }, []);

  const start = useCallback((id: string, anchor: ResizeAnchor, worldX: number, worldY: number) => {
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
    };
    for (const b of behaviorsRef.current) (b as ResizeBehavior<ResizePose>).onStart?.(ctx as unknown as GestureContext<ResizePose>);
    onGestureStart?.(id);
    setOverlay({ id, currentPose: originPose, targetPose: originPose, anchor });
  }, [adapter, expandIds, onGestureStart]);

  const move = useCallback((worldX: number, worldY: number, modifiers: ModifierState): boolean => {
    const s = stateRef.current;
    if (!s.active || !s.ctx || !s.originPose || !s.originBounds || !s.id) return false;

    const geom = geometryRef.current;
    s.ctx.modifiers = modifiers;
    s.ctx.pointer = { worldX, worldY, clientX: 0, clientY: 0 };

    const dx = worldX - s.start.worldX;
    const dy = worldY - s.start.worldY;
    const ob = s.originBounds;

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
    let proposedBounds: ResizePose = { x: nx, y: ny, width: nw, height: nh };

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

    const proposedPose = geom.remapBounds(s.originPose, s.originBounds, proposedBounds);
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
    const currentPose = geom.remapBounds(s.originPose, s.originBounds, currentBounds);

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
  }, [adapter, cleanup, onGestureEnd, resizeLabel]);

  const cancel = useCallback(() => {
    cleanup();
    onGestureEnd?.(false);
  }, [cleanup, onGestureEnd]);

  return { start, move, end, cancel, isResizing: overlay !== null, overlay, adapter };
}
