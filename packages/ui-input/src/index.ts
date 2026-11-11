/**
 * @weasel-js/ui-input — what a key or a pointer does to a control, as pure functions: steps, sliders and
 * tracks, lists and grids, selection, reorder, focus order. No React, no DOM, nothing drawn.
 *
 * @packageDocumentation
 */
export { arrowDir, firstStop, stepStop, rovingKey, rowKey } from './list';
export type { ListShape, RovingResult, KeyPress, RowKeysShape, RowKeyAction } from './list';
export {
  typeaheadMatch, typeaheadStep, isOneChar, EMPTY_TYPEAHEAD, TYPEAHEAD_RESET_MS,
} from './typeahead';
export type { TypeaheadBuffer, TypeaheadShape } from './typeahead';
export { tabSort, tabStep } from './tabOrder';
export { COARSE_STEPS, arrowSteps, arrowMove, rangeKey } from './keySteps';
export { usableStops, attract, evenMap, sliderAt, clampOrdered, sliderKey } from './slider';
export type { SliderStop, SliderKeyShape, SliderAtShape, TrackMap } from './slider';
export { spanPlace, spanValue, spanShare, spanMap, spanHold, spanPan, spanZoom } from './span';
export type { Span } from './span';
export { editEnd, imeKey } from './textCommit';
export type { EditCause, EditEnd, EditEndShape, KeySource } from './textCommit';
export {
  moveItems, movedIndex, isNoopDrop, nudgeGap, gapByMidpoint, nearestGap, dropBand, isNudgeChord, nudgeOf,
} from './reorder';
export type { NudgeKey } from './reorder';
export { EDGE_SCROLL_MARGIN, edgePush, edgeScroll } from './edgeScroll';
export { HEADING_DRIFT, headingOf, headingCost, nearestToward } from './spatial';
export type { Heading } from './spatial';
export { treeKey } from './tree';
export type { TreeShape, TreeKeyResult } from './tree';
export { timerScheduler } from './scheduler';
export type { Scheduler } from './scheduler';
export { createStepRepeat, REPEAT_DELAY_MS, REPEAT_EVERY_MS } from './stepRepeat';
export type { StepRepeat, StepRepeatOptions } from './stepRepeat';
export { SWEEP_CAP, stepsOf, range, values, frames, until } from './sweep';
export type { Sweep, RangeSpec, FrameSpan, FrameOptions } from './sweep';
export { rowOffset, tileGrid, tileRows, tileKey, gridLayout, rovingGridTarget } from './grid';
export type { LastRow, Tiling, TileGrid, GridLayout } from './grid';
export { selection, selectionOfEach, selectionKeys, sweepFrom } from './selection';
export type {
  SelectState, SingleSelection, MultipleSelection, SelectionSpec, OwnSelection, SelectionEdit, SelectionModel,
} from './selection';
export type { Box } from './scalar';
