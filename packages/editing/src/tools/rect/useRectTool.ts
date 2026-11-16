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

/** The rectangle tool's options: the style it draws with, shared with every shape tool. */
export const RECT_TOOL_OPTIONS = shapeToolOptions({
  actionId: 'insert', name: 'Rectangle', keys: ['fill', 'stroke', 'strokeWidth'], style: { fill: DEFAULT_SHAPE_PAINT, stroke: null },
});

/**
 * Drag-to-draw rectangle tool.
 *
 * The `drag` binding routes to `insertAction`, which owns the live preview
 * and commits via the `insert` dep on release. Consumers wanting a custom
 * node give the dep a factory (`<SceneCanvas insertNodeFactories={{ rect }}>`)
 * rather than changing the tool. Grid snapping comes from the `snap` dep.
 */
export function createRectTool(options: InsertToolOptions = {}): Tool {
  const { behaviors, share } = options;
  return defineTool({
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
  });
}

/** {@link createRectTool}, kept while its options are. */
export function useRectTool(options: InsertToolOptions = {}): Tool {
  const { behaviors, share } = options;
  return useMemo(() => createRectTool({ behaviors, share }), [behaviors, share]);
}
