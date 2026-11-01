/**
 * @weasel-js/headless — component behavior with no substrate: what a DOM
 * component and a canvas-drawn widget both run, each drawing it its own way.
 *
 * @packageDocumentation
 */
export { firstStop, stepStop, rovingKey, rowKey } from './list';
export type { ListShape, RovingResult, KeyPress, RowKeysShape, RowKeyAction } from './list';
export {
  typeaheadMatch, typeaheadStep, EMPTY_TYPEAHEAD, TYPEAHEAD_RESET_MS,
} from './typeahead';
export type { TypeaheadBuffer, TypeaheadShape } from './typeahead';
export { tabSort, tabStep } from './focus';
export type { FocusScope, FocusScopeOptions } from './focus';
export { COARSE_STEPS, arrowSteps, arrowMove, rangeKey } from './keySteps';
export { usableStops, attract, clampOrdered, sliderKey } from './slider';
export type { SliderStop, SliderKeyShape } from './slider';
export { editEnd, imeKey } from './textCommit';
export type { EditCause, EditEnd, EditEndShape, KeySource } from './textCommit';
export {
  moveItems, movedIndex, isNoopDrop, nudgeGap, gapByMidpoint, nearestGap, isNudgeChord, nudgeOf,
} from './reorder';
export type { NudgeKey } from './reorder';
export { treeKey } from './tree';
export type { TreeShape, TreeKeyResult } from './tree';
export { timerScheduler } from './scheduler';
export type { Scheduler } from './scheduler';
export { createStepRepeat, REPEAT_DELAY_MS, REPEAT_EVERY_MS } from './stepRepeat';
export type { StepRepeat, StepRepeatOptions } from './stepRepeat';
export { UNBOUNDED, exactly, fixedWidth, clampTo, envPx, envNumber, centeredBaseline, offsetRect } from './measure';
export type { Constraints, FontSpec, TextExtent, MeasureEnv, Measured, HeadlessComponent } from './measure';
export {
  buttonParts, buttonMetrics, measureButton, BUTTON_SPINNER_SIZE, IDLE_PRESS, pressStep, isPressKey,
} from './button';
export type {
  ButtonSize, ButtonFace, ButtonPart, ButtonMetrics, ButtonLayout, PressState, PressInput,
} from './button';
export { listMode, LIST_ROLES, dropSide, ROW_GAP, rowListMetrics, measureRowList, rowAtY } from './rowList';
export type {
  ListMode, ListModeInput, RowFace, RowListFace, RowListMetrics, RowBox, RowListLayout,
} from './rowList';
