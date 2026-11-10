import { useMemo } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { DEFAULT_SHAPE_PAINT, shapeToolOptions } from '../shared/styleOptions';
import { shareToolOptions } from '@weasel-js/routing';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';
import { INSERT_DRAG_MODS } from 'interactions/actions/insert/action';

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
export function useEllipseTool(options: InsertToolOptions = {}): Tool {
  const { behaviors, share } = options;
  return useMemo(
    () =>
      defineTool({
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
      }),
    [behaviors, share],
  );
}
