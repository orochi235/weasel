import { useMemo } from 'react';
import { DEFAULT_SIMPLIFY_TOLERANCE, defineTool, type Tool, type ToolOptions } from '@weasel-js/core';
import { icon } from '../icons.gen';
import { SIMPLIFY_BRUSH_RADIUS_PX } from './simplifyBrush';

/** The Simplify brush's size and tolerance: the `simplifyBrush` action's params. */
export const SIMPLIFY_BRUSH_OPTIONS = {
  actionId: 'simplifyBrush',
  prefs: {
    name: 'Simplify brush',
    description: 'The size of the Simplify brush and how far its refit may stray.',
    children: {
      radiusPx: {
        kind: 'number', name: 'Size', description: 'The brush radius, in screen pixels.',
        default: SIMPLIFY_BRUSH_RADIUS_PX, min: 2, max: 400, step: 1, control: 'slider',
      },
      tolerance: {
        kind: 'number', name: 'Tolerance', description: 'How far the refit outline may stray from the anchors it replaces.',
        default: DEFAULT_SIMPLIFY_TOLERANCE, min: 0.1, max: 20, step: 0.1, control: 'slider',
      },
    },
  },
  size: { option: 'radiusPx', times: 1.25 },
  strength: { option: 'tolerance', times: 1.25 },
} satisfies ToolOptions;

/**
 * The Simplify brush, a path-edit tool: a declarative shell whose one binding
 * routes a drag to the `simplifyBrush` action, which owns the stroke, its
 * preview, its ring cursor, and its one undo entry. Its radius and tolerance
 * are its options ({@link SIMPLIFY_BRUSH_OPTIONS}), stepped by `[` `]` and
 * `Shift+[` `Shift+]`. It carries `edits-anchors`, so it is usable only
 * where the mode allows anchor editing.
 */
export function useSimplifyBrushTool(): Tool {
  return useMemo(() => defineTool({
    id: 'simplifyBrush',
    capabilities: ['edits-anchors'],
    hookName: 'useSimplifyBrushTool',
    presentation: { label: 'Simplify brush', group: 'path-edit', icon: icon('core:simplifyBrush') },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'simplifyBrush', opts: { id: 'simplifyBrush.drag' } }],
    options: SIMPLIFY_BRUSH_OPTIONS,
  }), []);
}
