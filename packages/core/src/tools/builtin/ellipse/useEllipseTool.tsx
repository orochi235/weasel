import { useMemo } from 'react';
import { defineTool } from '../../routing';
import { EllipseIcon } from '../../../icons';
import type { Tool } from '../../types';

/**
 * Drag-to-draw ellipse tool. Mirrors `useRectTool`: the `drag` binding
 * routes to `insertAction`, which owns the live preview and commits
 * through the `insert` dep. Alt toggles from-corner ⇄ from-center
 * mid-drag via the action's live modifier read.
 */
export function useEllipseTool(): Tool<null> {
  return useMemo(
    () =>
      defineTool<null>({
        id: 'ellipse',
        capabilities: ['creates-shapes'],
        hookName: 'useEllipseTool',
        cursor: 'crosshair',
        presentation: {
          label: 'Ellipse',
          group: 'shape',
          icon: <EllipseIcon />,
        },
        bindings: [
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: { params: { kind: 'ellipse' } },
          },
        ],
        initial: {},
      }),
    [],
  );
}
