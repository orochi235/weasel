import { useMemo } from 'react';
import { defineTool, type Tool, type ToolOptions } from '@weasel-js/core';
import { shareToolOptions, type ToolOptionShare } from '@weasel-js/routing';
import { icon } from '../icons.gen';
import { SIMPLIFY_BRUSH_PARAMS } from './simplifyBrush';

/** The Simplify brush's size and tolerance: the `simplifyBrush` action's params, the same form its
 *  last-operation panel shows. */
export const SIMPLIFY_BRUSH_TOOL_OPTIONS = {
  actionId: 'simplifyBrush',
  prefs: SIMPLIFY_BRUSH_PARAMS,
  size: { option: 'radiusPx', times: 1.25 },
  strength: { option: 'tolerance', times: 1.25 },
} satisfies ToolOptions;

/** Options for `useSimplifyBrushTool`. */
export interface UseSimplifyBrushToolOptions {
  /** Laid over its options' shares: `{ radiusPx: BRUSH_SIZE_PX }` (`@weasel-js/brush`) gives it the size every
   *  brush naming that key shares. Keep it stable across renders. */
  share?: ToolOptionShare;
}

/**
 * The Simplify brush, a path-edit tool: a declarative shell whose one binding
 * routes a drag to the `simplifyBrush` action, which owns the stroke, its
 * preview, its ring cursor, and its one undo entry. Its radius and tolerance
 * are its options ({@link SIMPLIFY_BRUSH_TOOL_OPTIONS}), stepped by `[` `]` and
 * `Shift+[` `Shift+]`. It carries `edits-anchors`, so it is usable only
 * where the mode allows anchor editing.
 */
export function useSimplifyBrushTool(options: UseSimplifyBrushToolOptions = {}): Tool {
  const { share } = options;
  return useMemo(() => defineTool({
    id: 'simplifyBrush',
    capabilities: ['edits-anchors'],
    hookName: 'useSimplifyBrushTool',
    presentation: { label: 'Simplify brush', group: 'path-edit', icon: icon('core:simplifyBrush') },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'simplifyBrush', opts: { id: 'simplifyBrush.drag' } }],
    options: shareToolOptions(SIMPLIFY_BRUSH_TOOL_OPTIONS, share),
  }), [share]);
}
