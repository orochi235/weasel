export { createTextLayer } from './textLayer';
export type { CreateTextLayerOpts } from './textLayer';
export { useTextEdit, TEXT_EDIT_FONT_HOLD } from '@weasel-js/text-dom';
export type {
  TextEditScreenPose,
  TextEditClipRect,
  TextEditCommit,
  TextEditSelection,
  StartEditOptions,
  UseTextEditOptions,
  UseTextEditReturn,
} from '@weasel-js/text-dom';
export { useSceneTextEdit } from './useSceneTextEdit';
export type { UseSceneTextEditOptions } from './useSceneTextEdit';
export { textCommand, textCommandFromRuns, textCommandFromPose } from './textCommand';
export {
  runsToDom,
  domToRuns,
  charOffsetToDomPosition,
  domPositionToCharOffset,
} from '@weasel-js/text-dom';
export { textToPath, textToPathsByPaint, loadTextOutlines, TextOutlinesError } from './textToPath';
export type {
  TextOutlineSource, TextNodeSource, TextPaintPath, TextToPathOptions, TextOutlinesFailure,
} from './textToPath';
