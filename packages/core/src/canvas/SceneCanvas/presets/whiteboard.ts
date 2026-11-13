import { toolSet, type ToolSet } from '@weasel-js/routing';
import type { BuiltinToolId } from '../builtinToolSets';
import type { FeaturePreset } from '../features';
import { pickPreset } from './composites';
import { editPreset } from './edit';
import { movePreset, resizePreset } from './transform';
import { viewPreset } from './view';

/** The tools a whiteboard makes things with: the pencil, text, and the sticky note. */
export const WHITEBOARD_TOOLS: ToolSet<BuiltinToolId> = toolSet('whiteboard', ['pencil', 'text', 'sticky']);

/**
 * A whiteboard: {@link WHITEBOARD_TOOLS} on an open canvas you pan and zoom, with the select tool, moving,
 * resizing and editing what is on it. A note is the sticky tool's, a text node with a `background`; its look is
 * `toolOptions.sticky`.
 */
export const whiteboardPreset: FeaturePreset = {
  id: 'whiteboard',
  label: 'Whiteboard',
  tools: [WHITEBOARD_TOOLS],
  includes: [viewPreset, pickPreset, movePreset, resizePreset, editPreset],
};
