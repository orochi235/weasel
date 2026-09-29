export * from './renderLabel';
export { createTextLayer } from './textLayer';
export type { CreateTextLayerOpts } from './textLayer';
export { pointInTextPose, caretIndexAt } from './hitTest';
export type { PointInTextPoseOpts } from './hitTest';
export { fitTextPose } from './fitTextPose';
export type { FitTextPoseOptions } from './fitTextPose';
export { useTextEdit } from './useTextEdit';
export type {
  TextEditScreenPose,
  TextEditClipRect,
  TextEditSelection,
  StartEditOptions,
  UseTextEditOptions,
  UseTextEditReturn,
} from './useTextEdit';
export { useSceneTextEdit } from './useSceneTextEdit';
export type { UseSceneTextEditOptions } from './useSceneTextEdit';
export { styleAtRange, applyStyleToRange, patchRangeStyle } from './runs/rangeStyle';
export type { RangeStyle, RunStylePatch, StyleKey } from './runs/rangeStyle';
export { effectiveRangeStyle, rangeWeight } from './runs/effectiveRangeStyle';
export { setFlagOverRange, nodeHasFlag, unboldPatch } from './runs/flagRange';
export type { FlagKey, SetFlagResult } from './runs/flagRange';
export { textCommand, textCommandFromRuns, textCommandFromPose } from './textCommand';
export {
  runsToDom,
  domToRuns,
  charOffsetToDomPosition,
  domPositionToCharOffset,
} from './domRuns';
export { textToPath, textToPathsByPaint, loadTextOutlines, TextOutlinesError } from './textToPath';
export type {
  TextOutlineSource, TextNodeSource, TextPaintPath, TextToPathOptions, TextOutlinesFailure,
} from './textToPath';
