import { useMemo } from 'react';
import { defineTool, type Tool, type ToolOptions } from '@weasel-js/core';
import { shareToolOptions, type ToolOptionShare } from '@weasel-js/routing';
import { icon } from '../icons.gen';
import { SAND_PARAMS } from './sand';
import type {} from '../actionParamSchema';

/** Sand's size and tolerance: the `sand` action's params, the same form its
 *  last-operation panel shows. */
export const SAND_TOOL_OPTIONS = {
  actionId: 'sand',
  prefs: SAND_PARAMS,
  size: { option: 'radiusPx', times: 1.25 },
  strength: { option: 'tolerance', times: 1.25 },
} satisfies ToolOptions;

/** Options for `useSandTool`. */
export interface UseSandToolOptions {
  /** Laid over its options' shares: `{ radiusPx: BRUSH_SIZE_PX }` (`@weasel-js/brush`) gives it the size every
   *  brush naming that key shares. Keep it stable across renders. */
  share?: ToolOptionShare;
}

/**
 * Sand, a path-edit tool: a declarative shell whose one binding
 * routes a drag to the `sand` action, which owns the stroke, its
 * preview, its ring cursor, and its one undo entry. Its radius and tolerance
 * are its options ({@link SAND_TOOL_OPTIONS}), stepped by `[` `]` and
 * `Shift+[` `Shift+]`. It carries `edits-anchors`, so it is usable only
 * where the mode allows anchor editing.
 */
export function useSandTool(options: UseSandToolOptions = {}): Tool {
  const { share } = options;
  return useMemo(() => defineTool({
    id: 'sand',
    capabilities: ['edits-anchors'],
    hookName: 'useSandTool',
    presentation: { label: 'Sand', group: 'path-edit', icon: icon('core:sand') },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'sand', opts: { id: 'sand.drag' } }],
    options: shareToolOptions(SAND_TOOL_OPTIONS, share),
  }), [share]);
}
