import { createTransformOp } from '../../../core/ops/transform';
import type { Op } from '../../../core/ops/types';
import type { NodeId } from '../../../core/scene/types';
import type { PoseDescriptor } from '../../gestures/resize/geometry';
import { flipPoseViaDescriptor, type FlipAxis } from '../flip/flip';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/** @experimental */
export interface FlipDeps<TPose> {
  getSelection: () => NodeId[];
  getPose: (id: NodeId) => TPose;
  geometry: PoseDescriptor<TPose>;
  applyBatch: (ops: Op[], label?: string) => void;
}

const AXES: readonly FlipAxis[] = ['x', 'y'];
const KEY_FOR: Record<FlipAxis, string[]> = { x: ['h', 'H'], y: ['v', 'V'] };
const ID_FOR: Record<FlipAxis, string> = { x: 'flip.horizontal', y: 'flip.vertical' };
const LABEL_FOR: Record<FlipAxis, string> = { x: 'Flip Horizontal', y: 'Flip Vertical' };

/** @experimental */
export function defaultFlipActions<TPose>(deps: FlipDeps<TPose>): Action[] {
  return AXES.map((axis): Action => ({
    id: ID_FOR[axis],
    label: LABEL_FOR[axis],
    defaultBinding: { key: KEY_FOR[axis], shift: true },
    run: () => {
      const sel = deps.getSelection();
      if (sel.length === 0) return;
      const ops: Op[] = sel.map((id) => {
        const from = deps.getPose(id);
        const to = flipPoseViaDescriptor(from, axis, deps.geometry);
        return createTransformOp<TPose>({ id, from, to });
      });
      deps.applyBatch(ops, 'Flip');
    },
    enabled: () => (deps.getSelection().length > 0 ? true : ActionDisabledReason.SelectionRequired),
  }));
}
