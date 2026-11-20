/**
 * `@weasel-js/editing/groups`: the `group` each kit action sits in, under short names, core's beside editing's,
 * for an `<ActionBar group>`, a menu or a palette to gather them by:
 *
 * ```tsx
 * import * as groups from '@weasel-js/editing/groups';
 * <ActionBar group={groups.history} />
 * <ActionBar group={groups.align} />
 * ```
 *
 * @packageDocumentation
 */
export { anchors, history, path, presentation, tool, viewport } from '@weasel-js/core/groups';
export {
  ALIGN_GROUP as align, CLIPBOARD_GROUP as clipboard, DISTRIBUTE_GROUP as distribute, EDIT_GROUP as edit,
  FLIP_GROUP as flip, INSERT_GROUP as insert, NUDGE_GROUP as nudge, PATHFINDER_GROUP as pathfinder,
  REORDER_GROUP as reorder, STRUCTURE_GROUP as structure, SWAP_GROUP as swap,
} from './actionGroups';
