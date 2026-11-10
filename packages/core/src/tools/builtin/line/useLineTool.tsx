import { useMemo } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { DEFAULT_SHAPE_PAINT, shapeToolOptions } from '../shared/styleOptions';
import { shareToolOptions } from '@weasel-js/routing';
import type { WorldPoint } from '@weasel-js/routing';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';
import { INSERT_DRAG_MODS } from 'interactions/actions/insert/action';

/** An endpoint of a line, in world coordinates. */
export type LinePoint = WorldPoint;

/** The line tool's options: the style it draws with, shared with every shape tool. */
export const LINE_TOOL_OPTIONS = shapeToolOptions({
  actionId: 'insert', name: 'Line', keys: ['stroke', 'strokeWidth'], style: { stroke: DEFAULT_SHAPE_PAINT },
});

/**
 * Drag-to-draw line tool. The `drag` binding routes to `insertAction`, which
 * commits through the `insert` dep with `{ kind: 'line', a, b }` endpoints
 * (not the AABB diagonal), so the drag direction is preserved.
 *
 * Shift constrains to 15° increments; alt mirrors the end around the start
 * (the drag is treated as a half-line).
 */
export function useLineTool(options: InsertToolOptions = {}): Tool {
  const { behaviors, share } = options;
  return useMemo(
    () =>
      defineTool({
        id: 'line',
        keybinding: { key: '\\' },
        capabilities: ['creates-shapes'],
        hookName: 'useLineTool',
        options: shareToolOptions(LINE_TOOL_OPTIONS, share),
        cursor: cursorFor('crosshair', { mark: 'line', fallback: 'crosshair' }),
        presentation: {
          label: 'Line',
          group: 'shape',
          icon: icon('line'),
        },
        bindings: [
          {
            spec: { kind: 'drag', mods: INSERT_DRAG_MODS },
            actionId: 'insert',
            opts: { id: 'line.drag', params: { kind: 'line' }, ...insertBindingBehaviors(behaviors) },
          },
          INSERT_REPOSITION_BINDING,
        ],
      }),
    [behaviors, share],
  );
}
