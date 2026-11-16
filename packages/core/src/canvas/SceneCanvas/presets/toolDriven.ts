import type { Action } from '@weasel-js/routing';
import { viewportDragPanAction } from 'interactions/actions/defaults/viewportDragPan';

/** Every kit action a core tool binds that the tool does not own: `viewport.dragPan`, which `viewPreset` also
 *  registers. A canvas registers one when a tool it carries binds it, so `defaultTools={['hand']}` drags the view
 *  without `viewPreset`. A preset's own are its `toolActions`. */
export const builtinToolActions: readonly Action[] = [viewportDragPanAction];
