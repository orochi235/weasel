import { useMemo } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import type { WorldPoint } from '@weasel-js/routing';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';

/** An endpoint of a line, in world coordinates. */
export type LinePoint = WorldPoint;

/**
 * Drag-to-draw line tool. The `drag` binding routes to `insertAction`, which
 * commits through the `insert` dep with `{ kind: 'line', a, b }` endpoints
 * (not the AABB diagonal), so the drag direction is preserved.
 *
 * Shift constrains to 15° increments; alt mirrors the end around the start
 * (the drag is treated as a half-line).
 */
export function useLineTool(options: InsertToolOptions = {}): Tool {
  const { behaviors } = options;
  return useMemo(
    () =>
      defineTool({
        id: 'line',
        keybinding: { key: '\\' },
        capabilities: ['creates-shapes'],
        hookName: 'useLineTool',
        cursor: cursorFor('crosshairLine', { fallback: 'crosshair' }),
        presentation: {
          label: 'Line',
          group: 'shape',
          icon: icon('line'),
        },
        bindings: [
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: { id: 'line.drag', params: { kind: 'line' }, ...insertBindingBehaviors(behaviors) },
          },
          INSERT_REPOSITION_BINDING,
        ],
      }),
    [behaviors],
  );
}
