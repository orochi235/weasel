/**
 * @weasel-js/text-dom — in-place text editing: a contenteditable overlay that
 * reads and writes the styled runs of `@weasel-js/text`. The hook takes a
 * screen pose and a style and knows nothing about a scene graph or a renderer.
 *
 * @packageDocumentation
 */

export { useTextEdit } from './useTextEdit';
export { TEXT_EDIT_FONT_HOLD } from './textEditTypes';
export type {
  StyleToggle,
  TextEditScreenPose,
  TextEditClipRect,
  TextEditCommit,
  TextEditDraft,
  TextEditSelection,
  StartEditOptions,
  UseTextEditOptions,
  UseTextEditReturn,
} from './textEditTypes';
export { runsToDom, domToRuns, charOffsetToDomPosition, domPositionToCharOffset, type OverlayRunBase } from './domRuns';
