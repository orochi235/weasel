import { useMemo } from 'react';
import { toolSet, type Tool, type ToolSet } from '@weasel-js/core';
import { useStickyTool, type UseStickyToolOptions } from './tools/sticky/useStickyTool';
import { useTextTool } from './tools/text/useTextTool';

/** The ids {@link useTextToolsTools} keys its tools by. */
export type TextToolId = 'text' | 'sticky';

/** The text tools: text and the sticky note. A palette groups them as `text`. */
export const TEXT_TOOLS: ToolSet<TextToolId> = toolSet('text', ['text', 'sticky'], { label: 'Text' });

/** The tools a whiteboard makes things with: text and the sticky note. A pencil is `@weasel-js/path-tools`'. */
export const WHITEBOARD_TOOLS: ToolSet<TextToolId> = toolSet('whiteboard', ['text', 'sticky'], { label: 'Whiteboard' });

/**
 * Every tool in {@link TEXT_TOOLS}, keyed by id, for `<SceneCanvas tools>` beside `textPreset`, whose actions
 * they bind. `textToolsPreset` mounts the same tools without a hook.
 */
export function useTextToolsTools(options: UseStickyToolOptions = {}): Record<TextToolId, Tool> {
  const text = useTextTool({ behaviors: options.behaviors, share: options.share });
  const sticky = useStickyTool(options);
  return useMemo(() => ({ text, sticky }), [text, sticky]);
}
