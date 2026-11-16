/**
 * Text as `<SceneCanvas features>` presets. `textPreset` teaches a canvas the
 * text node kind and opens it for editing; `textToolsPreset` adds the text and
 * sticky-note tools, and `whiteboardPreset` a whiteboard made with them.
 */
import { isTextData } from '@weasel-js/text';
import {
  editPreset, movePreset, pickPreset, resizePreset, viewPreset, type FeaturePreset, type NodeRoutingEntry,
} from '@weasel-js/core';
import { editEffectTextAction } from './actions/editEffectText';
import { editTextAtAction } from './actions/editTextAt';
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
 * `textEdit` dep; `enterTextEdit`, a double-click opening text in place (`editTextAt`), and a click on a path
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
    actions: [enterTextEditAction, editTextAtAction, editEffectTextAction],
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

/** The text and sticky-note tools, with the text preset whose actions and inserts they bind. */
export function createTextToolsPreset(options: TextToolsPresetOptions = {}): FeaturePreset {
  const { behaviors, share, sticky, text = textPreset } = options;
  return {
    id: 'tools:text',
    label: 'Text tools',
    tools: [createTextTool({ behaviors, share }), createStickyTool({ ...sticky, behaviors, share })],
    includes: [text],
  };
}

/** {@link createTextToolsPreset} with its defaults. */
export const textToolsPreset: FeaturePreset = createTextToolsPreset();

/**
 * A whiteboard: the pencil, text and the sticky note on an open canvas you pan and zoom, with the select tool,
 * moving, resizing and editing what is on it. A note is the sticky tool's, a text node with a `background`.
 */
export const whiteboardPreset: FeaturePreset = {
  id: 'whiteboard',
  label: 'Whiteboard',
  tools: ['pencil'],
  includes: [viewPreset, pickPreset, movePreset, resizePreset, editPreset, textToolsPreset],
};
