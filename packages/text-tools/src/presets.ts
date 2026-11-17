/**
 * Text as `<SceneCanvas features>` presets. `textPreset` teaches a canvas the
 * text node kind and opens it for editing; `textToolsPreset` adds the text and
 * sticky-note tools, and `whiteboardPreset` a whiteboard made with them.
 */
import { isTextData } from '@weasel-js/text';
import { viewPreset, type FeaturePreset, type NodeRoutingEntry } from '@weasel-js/core';
import { editEffectTextAction } from './actions/editEffectText';
import { enterTextEditAtAction } from './actions/enterTextEditAt';
import { enterTextEditAction } from './actions/enterTextEdit';
import { canvasTextEditor, type CanvasTextEditorOptions } from './editor/canvasEditor';
import type { DefaultTextData } from './editor/useSceneTextEdit';
import { textContentHandler } from './ingest/textHandler';
import { textNodeFactory } from './node/insert';
import { TEXT_PROPERTIES } from './node/properties';
import { TEXT_PAINTER } from './node/textPainter';
import { stickyNodeFactory } from './tools/sticky/stickyNode';
import { createStickyTool, type UseStickyToolOptions } from './tools/sticky/useStickyTool';
import { createTextTool } from './tools/text/useTextTool';
import { editPreset, insertPreset, movePreset, pickPreset, resizePreset } from '@weasel-js/editing';

/** Routes a leaf whose `data.text` is a string as `'text'`, ahead of the canvas's own routing, so an
 *  SVG-imported text node carrying a fallback `path` routes to text edit. */
export const textNodeRouting: NodeRoutingEntry = {
  name: 'text', matches: (data, node) => node?.kind !== 'group' && isTextData(data),
};

/** Options for {@link createTextPreset}. */
export interface TextPresetOptions<TData = DefaultTextData> {
  /** The canvas's own editor: `useSceneTextEdit`'s options, or `false` for none. Default `{}`. It mounts its
   *  overlay in the canvas's offset parent, so the canvas wants a positioned ancestor, and stands down for a
   *  host's own editor: a `useSceneTextEdit` whose container holds the canvas, or a `textEdit` dep a child of
   *  the canvas registers. Wire one of those for character controls, which read the edit's state. */
  editor?: CanvasTextEditorOptions<TData>;
}

/**
 * The text node kind and its editing, configured by `options`: the `kit:text` painter, whose glyphs are its
 * outline; `'text'` routing and properties; the `text` and `sticky` inserts; the canvas's own editor and the
 * `textEdit` dep; `enterTextEdit`, a double-click opening text in place (`enterTextEditAt`), and a click on a path
 * effect's hidden text opening it (`editEffectText`); and plain-text paste.
 */
export function createTextPreset<TData = DefaultTextData>(options: TextPresetOptions<TData> = {}): FeaturePreset {
  return {
    id: 'text',
    label: 'Text',
    shapes: [TEXT_PAINTER],
    routing: [textNodeRouting],
    properties: [TEXT_PROPERTIES],
    insertNodeFactories: { text: textNodeFactory, sticky: stickyNodeFactory },
    actions: [enterTextEditAction, enterTextEditAtAction, editEffectTextAction],
    components: [canvasTextEditor(options.editor as CanvasTextEditorOptions | undefined)],
    contentHandlers: [textContentHandler],
  };
}

/** {@link createTextPreset} with its defaults. */
export const textPreset: FeaturePreset = createTextPreset();

/** Options for {@link createTextToolsPreset}: the insert behaviors both tools take, and the sticky notes' look. */
export interface TextToolsPresetOptions extends Pick<UseStickyToolOptions, 'behaviors' | 'share'> {
  sticky?: Omit<UseStickyToolOptions, 'behaviors' | 'share'>;
  /** The text preset the tools need, for a canvas configuring its editor. Default {@link textPreset}. */
  text?: FeaturePreset;
}

/** The text and sticky-note tools, with the text preset whose actions they bind and editing's `insertPreset`,
 *  whose `insert` action and dep they insert through. */
export function createTextToolsPreset(options: TextToolsPresetOptions = {}): FeaturePreset {
  const { behaviors, share, sticky, text = textPreset } = options;
  return {
    id: 'tools:text',
    label: 'Text tools',
    tools: [createTextTool({ behaviors, share }), createStickyTool({ ...sticky, behaviors, share })],
    includes: [text, insertPreset],
  };
}

/** {@link createTextToolsPreset} with its defaults. */
export const textToolsPreset: FeaturePreset = createTextToolsPreset();

/**
 * A whiteboard: text and the sticky note on an open canvas you pan and zoom, with the select tool, moving,
 * resizing and editing what is on it. A note is the sticky tool's, a text node with a `background`. A pencil is
 * `@weasel-js/path-tools`' `usePencilTool`, passed in `tools`.
 */
export const whiteboardPreset: FeaturePreset = {
  id: 'whiteboard',
  label: 'Whiteboard',
  includes: [viewPreset, pickPreset, movePreset, resizePreset, editPreset, textToolsPreset],
};
