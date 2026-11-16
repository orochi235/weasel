import type { FeaturePreset } from '@weasel-js/core';
import { insertAction } from '../actions/insert/action';
import { placeAction } from '../actions/insert/placeAction';
import { insertRepositionAction } from '../actions/insert/repositionAction';
import { insertRotateAction } from '../actions/insert/rotateAction';
import { KIT_INSERT_KINDS } from '../deps/insert';
import { InsertDeps } from '../deps/presetDeps';
import { selectionPreset } from './selection';

/** Drag-to-insert and click-to-place: the `insert` dep, and the actions a tool inserting a node binds, each
 *  registered once a tool on the canvas binds it. Every tool that makes a node needs it on: the kit's shape tools,
 *  `@weasel-js/text-tools`' and `@weasel-js/path-tools`' drawing tools. */
export const insertPreset: FeaturePreset = {
  id: 'insert',
  label: 'Insert',
  toolActions: [insertAction, placeAction, insertRotateAction, insertRepositionAction],
  insertKinds: KIT_INSERT_KINDS,
  components: [InsertDeps],
  includes: [selectionPreset],
};
