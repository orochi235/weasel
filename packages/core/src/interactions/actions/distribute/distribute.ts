import { useCallback, useRef } from 'react';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { NodeId } from 'core/scene/types';
import { RECT_POSE_DESCRIPTOR, type PoseProjection } from '../resize/geometry';
import { translatePoseViaDescriptor, visualBoundsViaDescriptor } from '../align/align';
import { planDistribute } from './plan';

/** Axis along which selection is distributed. `'x'` spreads horizontally. */
export type DistributeAxis = 'x' | 'y';

/** `'centers'` spaces centers equally; `'gaps'` makes the gap between
 *  consecutive items equal. Both measure a rotated item by its ink extent.
 *  Endpoints stay put in both modes. */
export type DistributeMode = 'centers' | 'gaps';

/** Adapter for `useDistribute`. */
export interface DistributeAdapter<TPose> {
  getSelection(): NodeId[];
  getPose(id: NodeId): TPose;
  applyOps?(ops: Op[], label?: string): void;
}

/** Options for `useDistribute`. */
export interface UseDistributeOptions<TPose> {
  /** Projection between `TPose` and bounds. Defaults to `RECT_POSE_DESCRIPTOR`
   *  for `{x,y,width,height}` poses. */
  geometry?: PoseProjection<TPose>;
  /** Default mode when `distribute(axis)` is called without one. Default 'centers'. */
  defaultMode?: DistributeMode;
  /** Label passed to applyOps. Default 'Distribute'. */
  label?: string;
}

/** Return shape of `useDistribute`. */
export interface UseDistributeReturn {
  /** Imperative trigger. No-op when fewer than 3 items selected. */
  distribute(axis: DistributeAxis, mode?: DistributeMode): void;
}

/** Distribute the current multi-selection along `axis`. Requires ≥3 items;
 *  no-op otherwise. Endpoints (min and max along the axis) stay put; the
 *  remaining items are repositioned. Single batch — one undo step. */
export function useDistribute<TPose>(
  adapter: DistributeAdapter<TPose>,
  options: UseDistributeOptions<TPose> = {},
): UseDistributeReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const distribute = useCallback((axis: DistributeAxis, mode?: DistributeMode): void => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    if (sel.length < 3) return;
    const geom =
      o.geometry ??
      (RECT_POSE_DESCRIPTOR as unknown as PoseProjection<TPose>);
    const m = mode ?? o.defaultMode ?? 'centers';

    const items = sel.map((id) => {
      const pose = a.getPose(id);
      return { id, pose, b: visualBoundsViaDescriptor(pose, geom) };
    });
    const targets = planDistribute(items.map((it) => it.b), axis, m);

    const ops: Op[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const delta = targets[i] - (axis === 'x' ? it.b.x : it.b.y);
      if (delta === 0) continue;
      const dx = axis === 'x' ? delta : 0;
      const dy = axis === 'y' ? delta : 0;
      const to = translatePoseViaDescriptor(it.pose, dx, dy, geom);
      ops.push(createTransformOp<TPose>({ id: it.id, from: it.pose, to }));
    }
    if (ops.length === 0) return;
    dispatchApplyBatch(a, ops, o.label ?? 'Distribute');
  }, []);

  return { distribute };
}
