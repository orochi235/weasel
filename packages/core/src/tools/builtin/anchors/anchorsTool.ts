import { defineTool, type Tool } from '../../overlayBinding';
import { icon } from '../../../icons.gen';

/** The id of {@link anchorsTool}, which `PATH_EDIT` names as its `defaultTool`. The `pathEdit`
 *  preset mounts it. */
export const ANCHORS_TOOL_ID = 'anchors';

/**
 * Path edit's anchor editing, as a tool: what a drag in path edit does with no
 * other path-edit tool on. It binds nothing. Anchor editing's bindings —
 * `editAnchors`, the marquee, the segment bend and the rest the `pathEdit`
 * preset registers — are ambient, so they take a gesture under any tool that
 * leaves it unclaimed; a path-edit tool such as the Simplify brush claims the
 * drag at the active tier, which outranks them. Holding the active slot is
 * what this tool is for: it is the tool path edit starts on and Escape
 * returns to.
 */
export const anchorsTool: Tool = defineTool({
  id: ANCHORS_TOOL_ID,
  keybinding: { key: 'A' },
  capabilities: ['edits-anchors'],
  hookName: 'anchorsTool',
  presentation: { label: 'Anchors', icon: icon('anchors'), group: 'path-edit' },
});
