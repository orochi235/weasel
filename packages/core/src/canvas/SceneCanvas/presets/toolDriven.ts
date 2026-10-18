import type { Action } from '@weasel-js/routing';
import { enterTextEditAction } from 'interactions/actions/defaults/enterTextEdit';
import { insertAction } from 'interactions/actions/insert/action';
import { placeAction } from 'interactions/actions/insert/placeAction';
import { insertRepositionAction } from 'interactions/actions/insert/repositionAction';
import { insertRotateAction } from 'interactions/actions/insert/rotateAction';

/** Kit actions the built-in tools bind and no preset registers. A canvas
 *  registers one whenever a tool it carries binds it. */
export const toolDrivenActions: readonly Action[] = [
  insertAction, placeAction, insertRotateAction, insertRepositionAction, enterTextEditAction,
];
