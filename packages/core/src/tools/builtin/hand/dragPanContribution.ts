import type { Contribution } from '../../overlayBinding';
import type { DragPanParams } from '../../../interactions/actions/defaults/viewportDragPan';

/** Id of the entry {@link dragPanContribution} builds. */
export const DRAG_PAN_ID = 'viewport.dragPanBinding';

/** An always-live entry that pans the view on a drag no tool claims. No preset
 *  installs it: the hand tool pans, space-held or chosen, and a canvas that
 *  should pan on a plain drag — a viewer, a map — adds this to its ambient
 *  list. `params` are `viewport.dragPan`'s, as the hand tool passes them. */
export function dragPanContribution(params: DragPanParams = {}): Contribution {
  return {
    id: DRAG_PAN_ID,
    eligibility: { always: true },
    bindings: [{
      spec: { kind: 'drag' },
      actionId: 'viewport.dragPan',
      ...(Object.keys(params).length > 0 ? { opts: { params: { ...params } } } : {}),
    }],
  };
}
