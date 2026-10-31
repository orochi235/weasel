import { useMemo } from 'react';
import { defineTool, type Tool } from '@weasel-js/core';
import { icon } from '../icons.gen';

/**
 * The Simplify brush, a path-edit tool: a declarative shell whose one binding
 * routes a drag to the `simplifyBrush` action, which owns the stroke, its
 * preview, its ring cursor, and its one undo entry. Its radius and tolerance
 * are that action's params. It carries `edits-anchors`, so it is usable only
 * where the mode allows anchor editing.
 */
export function useSimplifyBrushTool(): Tool {
  return useMemo(() => defineTool({
    id: 'simplifyBrush',
    capabilities: ['edits-anchors'],
    hookName: 'useSimplifyBrushTool',
    presentation: { label: 'Simplify brush', group: 'path-edit', icon: icon('core:simplifyBrush') },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'simplifyBrush', opts: { id: 'simplifyBrush.drag' } }],
  }), []);
}
