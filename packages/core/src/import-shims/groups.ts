/**
 * `@weasel-js/core/groups`: the `group` each of core's actions sits in, under short names, for an
 * `<ActionBar group>`, a menu or a palette to gather them by:
 *
 * ```tsx
 * import * as groups from '@weasel-js/core/groups';
 * <ActionBar group={groups.history} />
 * ```
 *
 * `@weasel-js/editing/groups` re-exports these beside editing's own.
 *
 * @packageDocumentation
 */
export {
  ANCHORS_GROUP as anchors, HISTORY_GROUP as history, PATH_GROUP as path, PRESENTATION_GROUP as presentation,
  VIEWPORT_GROUP as viewport,
} from '../interactions/actions/actionGroups';
export { TOOL_GROUP as tool } from '@weasel-js/routing';
