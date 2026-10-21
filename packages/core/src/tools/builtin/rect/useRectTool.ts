import { useMemo } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';

/**
 * Drag-to-draw rectangle tool.
 *
 * The `drag` binding routes to `insertAction`, which owns the live preview
 * and commits via the `insert` dep on release. Consumers wanting a custom
 * node factory override the dep (`useDepSource('insert', …)`) rather than
 * the tool. Grid snapping comes from the `snap` dep.
 */
export function useRectTool(options: InsertToolOptions = {}): Tool {
  const { behaviors } = options;
  return useMemo(
    () =>
      defineTool({
        id: 'rect',
        keybinding: { key: 'R' },
        capabilities: ['creates-shapes'],
        hookName: 'useRectTool',
        cursor: cursorFor('crosshairRect', { fallback: 'crosshair' }),
        presentation: {
          label: 'Rectangle',
          icon: icon('rect'),
          group: 'shape',
        },
        // Single binding: insertAction toggles corner ⇄ center on live Alt
        // state, so Alt can be engaged mid-drag.
        bindings: [
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: { id: 'rect.drag', params: { kind: 'rect' }, ...insertBindingBehaviors(behaviors) },
          },
          INSERT_REPOSITION_BINDING,
        ],
      }),
    [behaviors],
  );
}
