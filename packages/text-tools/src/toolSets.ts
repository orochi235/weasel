import { useMemo } from 'react';
import { toolSet, type BuiltinToolId, type Tool, type ToolSet } from '@weasel-js/core';
import { useStickyTool, type UseStickyToolOptions } from './tools/sticky/useStickyTool';
import { useTextTool } from './tools/text/useTextTool';

/** The ids {@link useTextToolsTools} keys its tools by. */
export type TextToolId = 'text' | 'sticky';

/** The text tools: text and the sticky note. A palette groups them as `type`. */
export const TEXT_TOOLS: ToolSet<TextToolId> = toolSet('type', ['text', 'sticky'], { label: 'Type' });

/** The tools a whiteboard makes things with: core's pencil, text, and the sticky note. */
export const WHITEBOARD_TOOLS: ToolSet<TextToolId | BuiltinToolId> = toolSet('whiteboard', ['pencil', 'text', 'sticky'], { label: 'Whiteboard' });

/**
 * Every tool in {@link TEXT_TOOLS}, keyed by id, for `<SceneCanvas tools>` beside `textPreset`, whose actions
 * they bind. `textToolsPreset` mounts the same tools without a hook.
 */
export function useTextToolsTools(options: UseStickyToolOptions = {}): Record<TextToolId, Tool> {
  const text = useTextTool({ behaviors: options.behaviors, share: options.share });
  const sticky = useStickyTool(options);
  return useMemo(() => ({ text, sticky }), [text, sticky]);
}
