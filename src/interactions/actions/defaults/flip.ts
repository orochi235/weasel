import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { PoseDescriptor } from '../../gestures/resize/geometry';
import {
  flipPoseAboutBounds,
  flipPoseViaDescriptor,
  type FlipAxis,
  type FlipPivot,
} from '../flip/flip';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/** @experimental */
export interface FlipDeps<TPose> {
  getSelection: () => NodeId[];
  getPose: (id: NodeId) => TPose;
  geometry: PoseDescriptor<TPose>;
  /** Static value or live thunk. Default `'each'`. */
  pivot?: FlipPivot | (() => FlipPivot);
  applyOps: (ops: Op[], label?: string) => void;
}

const AXES: readonly FlipAxis[] = ['x', 'y'];
const KEY_FOR: Record<FlipAxis, string[]> = { x: ['h', 'H'], y: ['v', 'V'] };
const ID_FOR: Record<FlipAxis, string> = { x: 'flip.horizontal', y: 'flip.vertical' };
const LABEL_FOR: Record<FlipAxis, string> = { x: 'Flip Horizontal', y: 'Flip Vertical' };

function readPivot<TPose>(deps: FlipDeps<TPose>): FlipPivot {
  const p = deps.pivot;
  if (p === undefined) return 'each';
  return typeof p === 'function' ? p() : p;
}

function unionAabb(rs: { x: number; y: number; width: number; height: number }[]): {
  x: number; y: number; width: number; height: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rs) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** @experimental */
export function defaultFlipActions<TPose>(deps: FlipDeps<TPose>): Action[] {
  return AXES.map((axis): Action => ({
    id: ID_FOR[axis],
    label: LABEL_FOR[axis],
    defaultBinding: { key: KEY_FOR[axis], shift: true },
    run: () => {
      const sel = deps.getSelection();
      if (sel.length === 0) return;
      const pivot = readPivot(deps);
      const poses = sel.map((id) => deps.getPose(id));
      const unionPivot = pivot === 'union' && sel.length > 1
        ? unionAabb(poses.map((p) => deps.geometry.getBounds(p)))
        : null;
      const ops: Op[] = sel.map((id, i): Op => {
        const from = poses[i];
        const to = unionPivot
          ? flipPoseAboutBounds(from, axis, deps.geometry, unionPivot)
          : flipPoseViaDescriptor(from, axis, deps.geometry);
        return createTransformOp<TPose>({ id, from, to });
      });
      deps.applyOps(ops, 'Flip');
    },
    enabled: () => (deps.getSelection().length > 0 ? true : ActionDisabledReason.SelectionRequired),
  }));
}
