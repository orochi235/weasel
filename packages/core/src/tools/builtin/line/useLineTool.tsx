import { useMemo } from 'react';
import { defineTool } from '../../defineTool';
import { LineIcon } from '../../../icons';
import type { Tool } from '../../types';

/** An endpoint of a line, in world coordinates. */
export interface LinePoint { x: number; y: number }

/**
 * Click-down → drag → release line tool. The `drag` binding routes to
 * `insertAction`, which owns the live preview and commits through the
 * `insert` dep with `{ kind: 'line', a, b }` endpoints (not the AABB
 * diagonal), so the drag direction is preserved.
 *
 * Modifiers are applied by `insertAction`:
 *   - shift: constrain to 15° increments
 *   - alt: mirror the end around the start (the drag is treated as a
 *     half-line) — the line-specific reading of the action's
 *     corner ⇄ center origin toggle
 */
export function useLineTool(): Tool<null> {
  return useMemo(
    () =>
      defineTool<null>({
        id: 'line',
        capabilities: ['creates-shapes'],
        hookName: 'useLineTool',
        cursor: 'crosshair',
        presentation: {
          label: 'Line',
          group: 'shape',
          icon: <LineIcon />,
        },
        bindings: [
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: { params: { kind: 'line' } },
          },
        ],
      }),
    [],
  );
}
