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

/** The rectangle tool's options: the style it draws with, shared with every shape tool. */
export const RECT_TOOL_OPTIONS = shapeToolOptions({
  actionId: 'insert', name: 'Rectangle', keys: ['fill', 'stroke', 'strokeWidth'], style: { fill: DEFAULT_SHAPE_PAINT, stroke: null },
});

/**
 * Drag-to-draw rectangle tool.
 *
 * The `drag` binding routes to `insertAction`, which owns the live preview
 * and commits via the `insert` dep on release. Consumers wanting a custom
 * node factory override the dep (`useDepSource('insert', …)`) rather than
 * the tool. Grid snapping comes from the `snap` dep.
 */
export function useRectTool(options: InsertToolOptions = {}): Tool {
  const { behaviors, share } = options;
  return useMemo(
    () =>
      defineTool({
        id: 'rect',
        keybinding: { key: 'R' },
        capabilities: ['creates-shapes'],
        hookName: 'useRectTool',
        options: shareToolOptions(RECT_TOOL_OPTIONS, share),
        cursor: cursorFor('crosshair', { mark: 'rect', fallback: 'crosshair' }),
        presentation: {
          label: 'Rectangle',
          icon: icon('rect'),
          group: 'shape',
        },
        // Single binding: insertAction toggles corner ⇄ center on live Alt
        // state, so Alt can be engaged mid-drag.
        bindings: [
          {
            spec: { kind: 'drag', mods: INSERT_DRAG_MODS },
            actionId: 'insert',
            opts: { id: 'rect.drag', params: { kind: 'rect' }, ...insertBindingBehaviors(behaviors) },
          },
          INSERT_REPOSITION_BINDING,
        ],
      }),
    [behaviors, share],
  );
}
