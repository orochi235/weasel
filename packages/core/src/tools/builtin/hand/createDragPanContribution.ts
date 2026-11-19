import { ANY_MODS } from '@weasel-js/gestures';
import type { Contribution } from '../../overlayBinding';
import type { DragPanParams } from '../../../interactions/actions/defaults/viewportDragPan';
import type {} from '../../../interactions/actions/actionParamSchema';

/** Id of the entry {@link createDragPanContribution} builds. */
export const DRAG_PAN_ID = 'viewport.dragPanBinding';

/** Id of the entry {@link createMiddleDragPanContribution} builds. */
export const MIDDLE_DRAG_PAN_ID = 'viewport.middleDragPanBinding';

function panEntry(id: string, button: 'primary' | 'middle', params: DragPanParams): Contribution {
  return {
    id,
    eligibility: { always: true },
    bindings: [{
      spec: button === 'middle' ? { kind: 'drag', button, mods: ANY_MODS } : { kind: 'drag' },
      actionId: 'viewport.dragPan',
      opts: { id: `${id}.drag`, ...(Object.keys(params).length > 0 ? { params: { ...params } } : {}) },
    }],
  };
}

/** An always-live entry that pans the view on a drag no tool claims. No preset
 *  installs it: the hand tool pans, space-held or chosen, and a canvas that
 *  should pan on a plain drag — a viewer, a map — adds this to its ambient
 *  list. `params` are `viewport.dragPan`'s, as the hand tool passes them. */
export function createDragPanContribution(params: DragPanParams = {}): Contribution {
  return panEntry(DRAG_PAN_ID, 'primary', params);
}

/** An always-live entry that pans the view on a middle-button drag, under any
 *  tool and with any modifier held. The `view` preset installs it; a canvas
 *  without that preset adds it to its ambient list. `params` are
 *  `viewport.dragPan`'s. */
export function createMiddleDragPanContribution(params: DragPanParams = {}): Contribution {
  return panEntry(MIDDLE_DRAG_PAN_ID, 'middle', params);
}
