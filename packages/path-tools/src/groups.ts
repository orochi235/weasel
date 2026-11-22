/**
 * `@weasel-js/path-tools/groups`: the `group` each of path-tools' own actions sits in, under short names, for an
 * `<ActionBar group>`, a menu or a palette to gather them by:
 *
 * ```tsx
 * import * as pathToolsGroups from '@weasel-js/path-tools/groups';
 * <ActionBar group={pathToolsGroups.anchorSelection} />
 * ```
 *
 * Its other actions sit in core's `anchors` and `path` groups and editing's `edit` and `pathfinder`
 * (`@weasel-js/editing/groups`).
 *
 * @packageDocumentation
 */
export { ANCHOR_SELECTION_GROUP as anchorSelection } from './anchorSelect/anchorSelect';
export { CONSTRAINTS_GROUP as constraints } from './constraints/anchorConstraints';
export { NUDGE_ANCHORS_GROUP as nudgeAnchors } from './pathEdit/anchorNudge';
export { TEXT_GROUP as text } from './outlines/createOutlinesAction';
export { PATH_EFFECTS_GROUP as pathEffects } from './pathEffects/actions';
export { PATH_OVERLAYS_GROUP as pathOverlays } from './overlays/showOverlay';
