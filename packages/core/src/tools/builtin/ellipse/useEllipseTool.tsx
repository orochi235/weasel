import { useMemo } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';

/**
 * Drag-to-draw ellipse tool. Mirrors `useRectTool`: the `drag` binding
 * routes to `insertAction`, which owns the live preview and commits
 * through the `insert` dep. Alt toggles from-corner ⇄ from-center
 * mid-drag via the action's live modifier read.
 */
export function useEllipseTool(options: InsertToolOptions = {}): Tool {
  const { behaviors } = options;
  return useMemo(
    () =>
      defineTool({
        id: 'ellipse',
        keybinding: { key: 'E' },
        capabilities: ['creates-shapes'],
        hookName: 'useEllipseTool',
        cursor: cursorFor('crosshairEllipse', { fallback: 'crosshair' }),
        presentation: {
          label: 'Ellipse',
          group: 'shape',
          icon: icon('ellipse'),
        },
        bindings: [
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: { id: 'ellipse.drag', params: { kind: 'ellipse' }, ...insertBindingBehaviors(behaviors) },
          },
          INSERT_REPOSITION_BINDING,
        ],
      }),
    [behaviors],
  );
}
