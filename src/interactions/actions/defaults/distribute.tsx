import type { ReactNode } from 'react';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { PoseDescriptor } from '../resize/geometry';
import { translatePoseViaDescriptor } from '../align/align';
import type { DistributeAxis, DistributeMode } from '../distribute/distribute';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import { DistributeHorizontalIcon, DistributeVerticalIcon } from './icons/distributeIcons';

/** @experimental */
export interface DistributeDeps<TPose> {
  getSelection: () => NodeId[];
  getPose: (id: NodeId) => TPose;
  geometry: PoseDescriptor<TPose>;
  applyOps: (ops: Op[], label?: string) => void;
  /** Mode used by the registered actions. Default `'centers'`. Override per-call
   *  via direct `useDistribute(...).distribute(axis, mode)` if needed. */
  mode?: DistributeMode;
}

const AXES: readonly DistributeAxis[] = ['x', 'y'];
const ID_FOR: Record<DistributeAxis, string> = { x: 'distribute.horizontal', y: 'distribute.vertical' };
const LABEL_FOR: Record<DistributeAxis, string> = { x: 'Distribute Horizontally', y: 'Distribute Vertically' };
const ICON_FOR: Record<DistributeAxis, ReactNode> = {
  x: <DistributeHorizontalIcon />,
  y: <DistributeVerticalIcon />,
};

function buildOps<TPose>(
  axis: DistributeAxis,
  mode: DistributeMode,
  deps: DistributeDeps<TPose>,
): Op[] {
  const sel = deps.getSelection();
  if (sel.length < 3) return [];
  const items = sel.map((id, i) => {
    const pose = deps.getPose(id);
    const b = deps.geometry.getBounds(pose);
    return { id, pose, b, origIndex: i };
  });
  const min = (b: { x: number; y: number; width: number; height: number }) => (axis === 'x' ? b.x : b.y);
  const size = (b: { x: number; y: number; width: number; height: number }) => (axis === 'x' ? b.width : b.height);
  const center = (b: { x: number; y: number; width: number; height: number }) => min(b) + size(b) / 2;

  const sorted = [...items].sort((p, q) => min(p.b) - min(q.b));
  const n = sorted.length;
  const first = sorted[0];
  const last = sorted[n - 1];
  const targetMin = new Map<number, number>();
  if (mode === 'centers') {
    const c0 = center(first.b);
    const cN = center(last.b);
    const stride = (cN - c0) / (n - 1);
    for (let i = 0; i < n; i++) {
      const it = sorted[i];
      targetMin.set(it.origIndex, c0 + stride * i - size(it.b) / 2);
    }
  } else {
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
    const delta = desired - min(it.b);
    if (delta === 0) continue;
    const dx = axis === 'x' ? delta : 0;
    const dy = axis === 'y' ? delta : 0;
    const to = translatePoseViaDescriptor(it.pose, dx, dy, deps.geometry);
    ops.push(createTransformOp<TPose>({ id: it.id, from: it.pose, to }));
  }
  return ops;
}

/** @experimental
 *
 * Two distribute actions registered with stable ids and labels but no default
 * keybindings. Pass `deps.mode` to pick `'centers'` (default) or `'gaps'`.
 * Wire bindings explicitly via the actions registry override map. */
export function defaultDistributeActions<TPose>(deps: DistributeDeps<TPose>): Action[] {
  return AXES.map((axis): Action => ({
    id: ID_FOR[axis],
    label: LABEL_FOR[axis],
    icon: ICON_FOR[axis],
    group: 'distribute',
    run: () => {
      const ops = buildOps(axis, deps.mode ?? 'centers', deps);
      if (ops.length > 0) deps.applyOps(ops, 'Distribute');
    },
    enabled: () => (deps.getSelection().length >= 3 ? true : ActionDisabledReason.SelectionRequired),
  }));
}
