import { useMemo } from 'react';
import { defineTool } from '@weasel-js/core';
import type { Tool } from '@weasel-js/core';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { DEFAULT_SHAPE_PAINT, shapeToolOptions } from '../shared/styleOptions';
import { shareToolOptions } from '@weasel-js/routing';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../icons.gen';
import { INSERT_REPOSITION_BINDING } from '../../actions/insert/repositionAction';
import { INSERT_DRAG_MODS } from '../../actions/insert/action';

/** The ellipse tool's options: the style it draws with, shared with every shape tool. */
export const ELLIPSE_TOOL_OPTIONS = shapeToolOptions({
  actionId: 'insert', name: 'Ellipse', keys: ['fill', 'stroke', 'strokeWidth'], style: { fill: DEFAULT_SHAPE_PAINT, stroke: null },
});

/**
 * Drag-to-draw ellipse tool. Mirrors `useRectTool`: the `drag` binding
 * routes to `insertAction`, which owns the live preview and commits
 * through the `insert` dep. Alt toggles from-corner ⇄ from-center
 * mid-drag via the action's live modifier read.
 */
export function createEllipseTool(options: InsertToolOptions = {}): Tool {
  const { behaviors, share } = options;
  return defineTool({
    id: 'ellipse',
    keybinding: { key: 'E' },
    capabilities: ['creates-shapes'],
    hookName: 'useEllipseTool',
    options: shareToolOptions(ELLIPSE_TOOL_OPTIONS, share),
    cursor: cursorFor('crosshair', { mark: 'ellipse', fallback: 'crosshair' }),
    presentation: {
      label: 'Ellipse',
      group: 'shape',
      icon: icon('ellipse'),
    },
    bindings: [
      {
        spec: { kind: 'drag', mods: INSERT_DRAG_MODS },
        actionId: 'insert',
        opts: { id: 'ellipse.drag', params: { kind: 'ellipse' }, ...insertBindingBehaviors(behaviors) },
      },
      INSERT_REPOSITION_BINDING,
    ],
  });
}

/** {@link createEllipseTool}, kept while its options are. */
export function useEllipseTool(options: InsertToolOptions = {}): Tool {
  const { behaviors, share } = options;
  return useMemo(() => createEllipseTool({ behaviors, share }), [behaviors, share]);
}
