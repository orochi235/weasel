import { useMemo } from 'react';
import { defineTool } from '../../overlayBinding';
import { LineIcon } from '../../../icons';
import type { Tool } from '../../overlayBinding';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { cursorFor } from '@weasel-js/cursor';

/** An endpoint of a line, in world coordinates. */
export interface LinePoint { x: number; y: number }

/**
 * Drag-to-draw line tool. The `drag` binding routes to `insertAction`, which
 * commits through the `insert` dep with `{ kind: 'line', a, b }` endpoints
 * (not the AABB diagonal), so the drag direction is preserved.
 *
 * Shift constrains to 15° increments; alt mirrors the end around the start
 * (the drag is treated as a half-line).
 */
export function useLineTool(options: InsertToolOptions = {}): Tool<null> {
  const { behaviors } = options;
  return useMemo(
    () =>
      defineTool<null>({
        id: 'line',
        keybinding: { key: '\\' },
        capabilities: ['creates-shapes'],
        hookName: 'useLineTool',
        cursor: cursorFor('crosshairLine', { fallback: 'crosshair' }),
        presentation: {
          label: 'Line',
          group: 'shape',
          icon: <LineIcon />,
        },
        bindings: [
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: { params: { kind: 'line' } , ...insertBindingBehaviors(behaviors) },
          },
        ],
      }),
    [behaviors],
  );
}
