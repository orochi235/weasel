export { createTextLayer } from './textLayer';
export type { CreateTextLayerOpts } from './textLayer';
export { useTextEdit, TEXT_EDIT_FONT_HOLD } from './useTextEdit';
export type {
  TextEditScreenPose,
  TextEditClipRect,
  TextEditCommit,
  TextEditSelection,
  StartEditOptions,
  UseTextEditOptions,
  UseTextEditReturn,
} from './useTextEdit';
export { useSceneTextEdit } from './useSceneTextEdit';
export type { UseSceneTextEditOptions } from './useSceneTextEdit';
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
