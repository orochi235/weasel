import { useCallback, useRef } from 'react';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { NodeId } from 'core/scene/types';
import { RECT_POSE_DESCRIPTOR, type PoseProjection } from '../resize/geometry';
import type { ResizePose } from '../../gestures/types';
import { axisAlignedBounds, unionAABB } from 'core/geometry/unionBounds';

/** Edge or center the selection should align to within the selection's visual
 *  union AABB (rotated members contribute their ink extent). */
export type AlignEdge = 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y';

/** Adapter for `useAlign`. */
export interface AlignAdapter<TPose> {
  getSelection(): NodeId[];
  getPose(id: NodeId): TPose;
  applyOps?(ops: Op[], label?: string): void;
}

/** Options for `useAlign`. */
export interface UseAlignOptions<TPose> {
  /** Projection between `TPose` and bounds. Defaults to `RECT_POSE_DESCRIPTOR`
   *  for `{x,y,width,height}` poses. Pass `pathPoseDescriptor` for `Path`
   *  poses so polygon coords translate correctly. */
  geometry?: PoseProjection<TPose>;
  /** Label passed to applyOps. Default 'Align'. */
  label?: string;
}

/** Return shape of `useAlign`. */
export interface UseAlignReturn {
  /** Imperative trigger. No-op when fewer than 2 items selected. */
  align(edge: AlignEdge): void;
}

/**
 * The pose's *visual* bounds: its descriptor bounds expanded to cover the
 * rotated rectangle, so a turned shape reports the extent of its ink rather
 * than the box it was posed in. Align, distribute and flip all fold these.
 *
 * Both ends of an align must use it — a visual union measured against
 * unrotated member boxes misplaces every rotated member. The expanded box
 * shares its centre with the stored one, so the delta stays a translation of
 * the stored pose and no re-posing is needed.
 */
export function visualBoundsViaDescriptor<TPose>(
  pose: TPose,
  geometry: PoseProjection<TPose>,
): ResizePose {
  const b = geometry.getBounds(pose);
  const rotation =
    geometry.getRotation?.(pose) ?? (b as { rotation?: number }).rotation ?? 0;
  return axisAlignedBounds({ x: b.x, y: b.y, width: b.width, height: b.height, rotation });
}

/** Compute the (dx, dy) translation that moves AABB `b` so that the requested
 *  `edge`/center matches the corresponding feature of the union AABB `u`. */
export function alignDeltaFor(b: ResizePose, u: ResizePose, edge: AlignEdge): { dx: number; dy: number } {
  switch (edge) {
    case 'left':     return { dx: u.x - b.x, dy: 0 };
    case 'right':    return { dx: (u.x + u.width) - (b.x + b.width), dy: 0 };
    case 'top':      return { dx: 0, dy: u.y - b.y };
    case 'bottom':   return { dx: 0, dy: (u.y + u.height) - (b.y + b.height) };
    case 'center-x': return { dx: (u.x + u.width / 2) - (b.x + b.width / 2), dy: 0 };
    case 'center-y': return { dx: 0, dy: (u.y + u.height / 2) - (b.y + b.height / 2) };
  }
}

/** Translate `pose` by `(dx, dy)` using `geometry.translate` if available,
 *  otherwise via `remapBounds` with a translated `dst` rect. */
export function translatePoseViaDescriptor<TPose>(
  pose: TPose,
  dx: number,
  dy: number,
  geometry: PoseProjection<TPose>,
): TPose {
  if (geometry.translate) return geometry.translate(pose, dx, dy);
  const src = geometry.getBounds(pose);
  const dst = { x: src.x + dx, y: src.y + dy, width: src.width, height: src.height };
  return geometry.remapBounds(pose, src, dst);
}

/** Align the current multi-selection to a shared edge or center of the
 *  selection's union AABB. No-op when fewer than 2 items selected.
 *  Single batch — one undo step. */
export function useAlign<TPose>(
  adapter: AlignAdapter<TPose>,
  options: UseAlignOptions<TPose> = {},
): UseAlignReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const align = useCallback((edge: AlignEdge): void => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    if (sel.length < 2) return;
    const geom =
      o.geometry ??
      (RECT_POSE_DESCRIPTOR as unknown as PoseProjection<TPose>);
    const poses = sel.map((id) => a.getPose(id));
    const bounds = poses.map((p) => visualBoundsViaDescriptor(p, geom));
    // Guarded non-empty by `sel.length < 2` above → `!` is safe.
    const union = unionAABB(bounds)!;
    const ops: Op[] = [];
    for (let i = 0; i < sel.length; i++) {
      const { dx, dy } = alignDeltaFor(bounds[i], union, edge);
      if (dx === 0 && dy === 0) continue;
      const from = poses[i];
      const to = translatePoseViaDescriptor(from, dx, dy, geom);
      ops.push(createTransformOp<TPose>({ id: sel[i], from, to }));
    }
    if (ops.length === 0) return;
    dispatchApplyBatch(a, ops, o.label ?? 'Align');
  }, []);

  return { align };
}
