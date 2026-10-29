/**
 * @weasel-js/headless — component behavior with no substrate: what a DOM
 * component and a canvas-drawn widget both run, each drawing it its own way.
 *
 * @packageDocumentation
 */
export { firstStop, stepStop, rovingKey } from './list';
export type { ListShape, RovingResult } from './list';
export {
  typeaheadMatch, typeaheadStep, EMPTY_TYPEAHEAD, TYPEAHEAD_RESET_MS,
} from './typeahead';
export type { TypeaheadBuffer, TypeaheadShape } from './typeahead';
export { tabSort, tabStep } from './focus';
export type { FocusScope, FocusScopeOptions } from './focus';
export {
  moveItems, movedIndex, isNoopDrop, nudgeGap, gapByMidpoint, nearestGap, isNudgeChord, nudgeOf,
} from './reorder';
export type { NudgeKey } from './reorder';
