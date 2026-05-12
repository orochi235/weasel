import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { PoseDescriptor } from '../../gestures/resize/geometry';
import type { ResizePose } from '../../gestures/types';
import { alignDeltaFor, translatePoseViaDescriptor, type AlignEdge } from '../align/align';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/** @experimental */
export interface AlignDeps<TPose> {
  getSelection: () => NodeId[];
  getPose: (id: NodeId) => TPose;
  geometry: PoseDescriptor<TPose>;
  applyOps: (ops: Op[], label?: string) => void;
}

const EDGES: readonly AlignEdge[] = ['left', 'right', 'top', 'bottom', 'center-x', 'center-y'];
const ID_FOR: Record<AlignEdge, string> = {
  'left': 'align.left',
  'right': 'align.right',
  'top': 'align.top',
  'bottom': 'align.bottom',
  'center-x': 'align.centerX',
  'center-y': 'align.centerY',
};
const LABEL_FOR: Record<AlignEdge, string> = {
  'left': 'Align Left',
  'right': 'Align Right',
  'top': 'Align Top',
  'bottom': 'Align Bottom',
  'center-x': 'Align Centers Horizontally',
  'center-y': 'Align Centers Vertically',
};

function unionBounds(rs: ResizePose[]): ResizePose {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rs) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** @experimental
 *
 * Six align actions registered with stable ids and labels but no default
 * keybindings — six edges/centers don't fit a clean default chord set.
 * Wire bindings explicitly via the actions registry override map. */
export function defaultAlignActions<TPose>(deps: AlignDeps<TPose>): Action[] {
  return EDGES.map((edge): Action => ({
    id: ID_FOR[edge],
    label: LABEL_FOR[edge],
    run: () => {
      const sel = deps.getSelection();
      if (sel.length < 2) return;
      const poses = sel.map((id) => deps.getPose(id));
      const bounds = poses.map((p) => deps.geometry.getBounds(p));
      const union = unionBounds(bounds);
      const ops: Op[] = [];
      for (let i = 0; i < sel.length; i++) {
        const { dx, dy } = alignDeltaFor(bounds[i], union, edge);
        if (dx === 0 && dy === 0) continue;
        const from = poses[i];
        const to = translatePoseViaDescriptor(from, dx, dy, deps.geometry);
        ops.push(createTransformOp<TPose>({ id: sel[i], from, to }));
      }
      if (ops.length > 0) deps.applyOps(ops, 'Align');
    },
    enabled: () => (deps.getSelection().length >= 2 ? true : ActionDisabledReason.SelectionRequired),
  }));
}
