import { useCallback, useRef } from 'react';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { NodeId } from 'core/scene/types';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../resize/geometry';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { unionAABB } from 'core/geometry/unionBounds';
import { poseFrame } from '../poseFrame';
import { IDENTITY_POSE_COMPOSITION, type PoseComposition } from 'features/groups/composePose';
import { usePointerContext } from 'features/pointer/PointerContext';
import { resolveSpatialReference, type SpatialReference, type SpatialReferenceSources } from '../spatialReference';

export { visualBoundsViaDescriptor, translatePoseViaDescriptor } from '../resize/geometry';
import { visualBoundsViaDescriptor, translatePoseViaDescriptor } from '../resize/geometry';

/** Edge or center the selection should align to within the reference's
 *  bounds (rotated members contribute their ink extent). */
export type AlignEdge = 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y';

/** @experimental What the selection aligns to: `'union'` — the selection's
 *  own visual union AABB, the default — or a {@link SpatialReference}. */
export type AlignReference = 'union' | SpatialReference;

/** @experimental The bounds each member of `bounds` aligns to under `to`, or
 *  `null` when there is nothing to align: a union of fewer than two members,
 *  an empty selection, or a reference that names nothing right now. */
export function alignTargetBounds(
  bounds: readonly Bounds[],
  to: AlignReference | undefined,
  src: SpatialReferenceSources,
): Bounds | null {
  if (to === undefined || to === 'union') return bounds.length < 2 ? null : unionAABB([...bounds]);
  if (bounds.length === 0) return null;
  return resolveSpatialReference(to, src);
}

/** Adapter for `useAlign`. */
export interface AlignAdapter<TPose> {
  getSelection(): NodeId[];
  /** The pose as stored — local to the node's parent. */
  getPose(id: NodeId): TPose;
  /** The parent chain, for a scene whose container poses define a frame.
   *  Omit it (or leave `composition` unset) for an absolute-pose scene. */
  getParent?(id: NodeId): NodeId | null;
  applyOps?(ops: Op[], label?: string): void;
}

/** Options for `useAlign`. */
export interface UseAlignOptions<TPose> {
  /** Projection between `TPose` and bounds. Defaults to `RECT_POSE_DESCRIPTOR`
   *  for `{x,y,width,height}` poses. Pass `pathPoseDescriptor` for `Path`
   *  poses so polygon coords translate correctly. */
  geometry?: PoseDescriptor<TPose>;
  /** Label passed to applyOps. Default 'Align'. */
  label?: string;
  /** How local poses fold up to world. Default IDENTITY, where the two are
   *  the same value and the alignment runs entirely in stored coordinates. */
  composition?: PoseComposition<TPose>;
}

/** Return shape of `useAlign`. */
export interface UseAlignReturn {
  /** Imperative trigger. `to` defaults to `'union'`, which needs two items;
   *  any other reference aligns a single item too. `'pointer'` reads the
   *  surrounding `<PointerContextProvider>`. */
  align(edge: AlignEdge, to?: AlignReference): void;
}

/** Compute the (dx, dy) translation that moves AABB `b` so that the requested
 *  `edge`/center matches the corresponding feature of the union AABB `u`. */
export function alignDeltaFor(b: Bounds, u: Bounds, edge: AlignEdge): { dx: number; dy: number } {
  switch (edge) {
    case 'left':     return { dx: u.x - b.x, dy: 0 };
    case 'right':    return { dx: (u.x + u.width) - (b.x + b.width), dy: 0 };
    case 'top':      return { dx: 0, dy: u.y - b.y };
    case 'bottom':   return { dx: 0, dy: (u.y + u.height) - (b.y + b.height) };
    case 'center-x': return { dx: (u.x + u.width / 2) - (b.x + b.width / 2), dy: 0 };
    case 'center-y': return { dx: 0, dy: (u.y + u.height / 2) - (b.y + b.height / 2) };
  }
}

/** Align the current selection to a shared edge or center of the selection's
 *  union AABB, or of another reference. Single batch — one undo step.
 *
 *  The edge is a world edge: bounds are measured and translated in world, and
 *  each result is stored back in its own parent's frame. */
export function useAlign<TPose>(
  adapter: AlignAdapter<TPose>,
  options: UseAlignOptions<TPose> = {},
): UseAlignReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;
  const pointer = usePointerContext();
  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;

  const align = useCallback((edge: AlignEdge, to?: AlignReference): void => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    const geom =
      o.geometry ??
      (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>);
    const frame = poseFrame<TPose>(
      {
        getPose: (id) => a.getPose(id as NodeId),
        getParent: (id) => (a.getParent?.(id as NodeId) ?? null) as string | null,
      },
      o.composition ?? (IDENTITY_POSE_COMPOSITION as PoseComposition<TPose>),
    );
    const poses = sel.map((id) => frame.world(id));
    const bounds = poses.map((p) => visualBoundsViaDescriptor(p, geom));
    const target = alignTargetBounds(bounds, to, {
      pointer: () => {
        const p = pointerRef.current?.get();
        return p ? { x: p.worldX, y: p.worldY } : null;
      },
      nodeBounds: (id) => visualBoundsViaDescriptor(frame.world(id), geom),
    });
    if (target === null) return;
    const ops: Op[] = [];
    for (let i = 0; i < sel.length; i++) {
      const { dx, dy } = alignDeltaFor(bounds[i], target, edge);
      if (dx === 0 && dy === 0) continue;
      const to = translatePoseViaDescriptor(poses[i], dx, dy, geom);
      ops.push(createTransformOp<TPose>({
        id: sel[i],
        from: a.getPose(sel[i]),
        to: frame.local(sel[i], to),
      }));
    }
    if (ops.length === 0) return;
    dispatchApplyBatch(a, ops, o.label ?? 'Align');
  }, []);

  return { align };
}
