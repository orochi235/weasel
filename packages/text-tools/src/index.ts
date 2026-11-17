/**
 * `@weasel-js/text-tools` — text for a weasel canvas: the text node kind, its
 * in-place editor, and the text and sticky-note tools, as presets an app turns
 * on beside core's: `features={[drawPreset, textPreset]}` for text nodes that
 * paint, pick and edit, `textToolsPreset` for the tools that make them. The text
 * engine itself (layout, fonts, runs) is `@weasel-js/text`.
 *
 * @packageDocumentation
 */
// Brings the `ActionParamSchema` entries and the `textEdit` dep into the declarations; `import type` so the bundle
// carries nothing for them.
import type {} from './actionParamSchema';
import type {} from './editor/textEditDep';

// ─── Presets ───────────────────────────────────────────────────────────────
export {
  createTextPreset, createTextToolsPreset, textNodeRouting, textPreset, textToolsPreset, whiteboardPreset,
  type TextPresetOptions, type TextToolsPresetOptions,
} from './presets';
export { TEXT_TOOLS, useTextToolsTools, type TextToolId } from './toolSets';

// ─── The text node kind ────────────────────────────────────────────────────
export {
  TEXT_PAINTER, textBoxOf, textLayoutScale, textPoseOf, type TextNodeData, type TextOverflow,
} from './node/textPainter';
export { edgeColor, textFrameOf, type TextEdge, type TextFrame, type TextShadow } from './node/textFrame';
export { textOutlineOf } from './node/textOutline';
export { textEffectItems } from './node/textItems';
export { TEXT_PROPERTIES } from './node/properties';
export { textNodeFactory } from './node/insert';

// ─── Editing ───────────────────────────────────────────────────────────────
export { useSceneTextEdit, type DefaultTextData, type UseSceneTextEditOptions, type UseSceneTextEditReturn } from './editor/useSceneTextEdit';
export { textEditJoin } from './editor/sceneTextDrafts';
export { drawOneEditing, withoutText, type EditingDrawOne } from './editor/editingDrawOne';
export { createTextLayer, type CreateTextLayerOptions } from './editor/textLayer';
export type { CanvasTextEditorOptions } from './editor/canvasEditor';
export type { TextEditDep } from './editor/textEditDep';

// ─── Actions ───────────────────────────────────────────────────────────────
export { enterTextEditAction } from './actions/enterTextEdit';
export { enterTextEditAtAction } from './actions/enterTextEditAt';
export { editEffectTextAction } from './actions/editEffectText';

// ─── Tools ─────────────────────────────────────────────────────────────────
export { createTextTool, TEXT_TOOL_OPTIONS, useTextTool } from './tools/text/useTextTool';
export { createStickyTool, STICKY_TOOL_OPTIONS, useStickyTool, type UseStickyToolOptions } from './tools/sticky/useStickyTool';
export { STICKY_DEFAULTS, stickyData, stickyNodeFactory, type StickyLook, type StickyStyle } from './tools/sticky/stickyNode';

// ─── Paste ─────────────────────────────────────────────────────────────────
export { createTextHandler, textContentHandler, type TextHandlerOptions } from './ingest/textHandler';
