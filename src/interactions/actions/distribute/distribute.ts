import { useCallback, useRef } from 'react';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { NodeId } from 'core/scene/types';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../resize/geometry';
import { translatePoseViaDescriptor } from '../align/align';

/** Axis along which selection is distributed. `'x'` spreads horizontally. */
export type DistributeAxis = 'x' | 'y';

/** `'centers'` spaces AABB centers equally; `'gaps'` makes the gap between
 *  consecutive AABBs equal. Endpoints stay put in both modes. */
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
  geometry?: PoseDescriptor<TPose>;
  /** Default mode when `distribute(axis)` is called without one. Default 'centers'. */
  defaultMode?: DistributeMode;
  /** Label passed to applyOps. Default 'Distribute'. */
  label?: string;
  /** Auto-register the two default distribute actions into a surrounding
   *  `<ActionsProvider>`. Default `true`. Pass `false` to skip registration. */
  enableKeyboard?: boolean;
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
      (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>);
    const m = mode ?? o.defaultMode ?? 'centers';

    const items = sel.map((id, i) => {
      const pose = a.getPose(id);
      const b = geom.getBounds(pose);
      return { id, pose, b, origIndex: i };
    });

    const min = (b: { x: number; y: number; width: number; height: number }) =>
      axis === 'x' ? b.x : b.y;
    const size = (b: { x: number; y: number; width: number; height: number }) =>
      axis === 'x' ? b.width : b.height;
    const center = (b: { x: number; y: number; width: number; height: number }) =>
      min(b) + size(b) / 2;

    const sorted = [...items].sort((p, q) => min(p.b) - min(q.b));
    const n = sorted.length;
    const first = sorted[0];
    const last = sorted[n - 1];

    const targetMin = new Map<number, number>();
    if (m === 'centers') {
      const c0 = center(first.b);
      const cN = center(last.b);
      const stride = (cN - c0) / (n - 1);
      for (let i = 0; i < n; i++) {
        const it = sorted[i];
        const targetCenter = c0 + stride * i;
        targetMin.set(it.origIndex, targetCenter - size(it.b) / 2);
      }
    } else {
      // 'gaps': equal spacing between consecutive AABBs.
      // gap = ((last.max - first.min) - sum(sizes)) / (n - 1)
      const span = (min(last.b) + size(last.b)) - min(first.b);
      let sumSizes = 0;
      for (const it of sorted) sumSizes += size(it.b);
      const gap = (span - sumSizes) / (n - 1);
      let cursor = min(first.b);
      for (let i = 0; i < n; i++) {
        const it = sorted[i];
        targetMin.set(it.origIndex, cursor);
        cursor += size(it.b) + gap;
      }
    }

    const ops: Op[] = [];
    for (const it of items) {
      const desired = targetMin.get(it.origIndex);
      if (desired === undefined) continue;
      const current = min(it.b);
      const delta = desired - current;
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
