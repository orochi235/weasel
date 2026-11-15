import type { Action } from '@weasel-js/routing';
import { areaSelectAction } from 'interactions/actions/defaults/areaSelect';
import { clearSelectionAction } from 'interactions/actions/defaults/clearSelection';
import { enterTextEditAction } from 'interactions/actions/defaults/enterTextEdit';
import { viewportDragPanAction } from 'interactions/actions/defaults/viewportDragPan';
import { insertAction } from 'interactions/actions/insert/action';
import { placeAction } from 'interactions/actions/insert/placeAction';
import { insertRepositionAction } from 'interactions/actions/insert/repositionAction';
import { insertRotateAction } from 'interactions/actions/insert/rotateAction';
import { lassoSelectAction } from 'interactions/actions/lasso-select/action';

/** Kit actions the built-in tools bind and no preset registers. A canvas
 *  registers one whenever a tool it carries binds it. */
export const toolDrivenActions: readonly Action[] = [
  insertAction, placeAction, insertRotateAction, insertRepositionAction, enterTextEditAction,
];

/** Every kit action a built-in tool binds that the tool does not own: the
 *  tool-driven ones, and those `selectPreset` and `viewPreset` also register.
 *  A canvas registers one when a tool it carries binds it, so a built-in tool
 *  works under any preset: `defaultTools={['hand']}` drags the view without
 *  `viewPreset`. */
export const builtinToolActions: readonly Action[] = [
  ...toolDrivenActions, areaSelectAction, lassoSelectAction, clearSelectionAction, viewportDragPanAction,
];
