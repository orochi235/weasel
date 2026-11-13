import type { Contribution } from '../../overlayBinding';
import type { DragPanParams } from '../../../interactions/actions/defaults/viewportDragPan';

/** Id of the entry {@link dragPanContribution} builds. */
export const DRAG_PAN_ID = 'viewport.dragPanBinding';

/** Id of the entry {@link middleDragPanContribution} builds. */
export const MIDDLE_DRAG_PAN_ID = 'viewport.middleDragPanBinding';

function panEntry(id: string, button: 'primary' | 'middle', params: DragPanParams): Contribution {
  return {
    id,
    eligibility: { always: true },
    bindings: [{
      spec: { kind: 'drag', ...(button === 'middle' ? { button } : {}) },
      actionId: 'viewport.dragPan',
      opts: { id: `${id}.drag`, ...(Object.keys(params).length > 0 ? { params: { ...params } } : {}) },
    }],
  };
}

/** An always-live entry that pans the view on a drag no tool claims. No preset
 *  installs it: the hand tool pans, space-held or chosen, and a canvas that
 *  should pan on a plain drag — a viewer, a map — adds this to its ambient
 *  list. `params` are `viewport.dragPan`'s, as the hand tool passes them. */
export function dragPanContribution(params: DragPanParams = {}): Contribution {
  return panEntry(DRAG_PAN_ID, 'primary', params);
}

/** An always-live entry that pans the view on a middle-button drag, under any
 *  tool. The `view` preset installs it; a canvas without that preset adds it to
 *  its ambient list. `params` are `viewport.dragPan`'s. */
export function middleDragPanContribution(params: DragPanParams = {}): Contribution {
  return panEntry(MIDDLE_DRAG_PAN_ID, 'middle', params);
}
