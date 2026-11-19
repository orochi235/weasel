/**
 * The `group` each of core's actions sits in, for an `<ActionBar group>`, a menu or a palette to gather them by.
 * Published under short names by `@weasel-js/core/groups`, beside the tool-option steps' `TOOL_GROUP` from routing.
 */

/** Undo and Redo. */
export const HISTORY_GROUP = 'history';

/** Panning, zooming and scrolling the view. */
export const VIEWPORT_GROUP = 'viewport';

/** Entering and leaving presentation. */
export const PRESENTATION_GROUP = 'presentation';

/** The actions that edit a path's selected anchors. */
export const ANCHORS_GROUP = 'anchors';

/** The actions that act on whole paths. */
export const PATH_GROUP = 'path';
