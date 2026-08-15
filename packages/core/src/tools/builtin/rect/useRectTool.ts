import { useMemo, createElement } from 'react';
import { defineTool } from '../../defineTool';
import { RectIcon } from '../../../icons';
import type { Tool } from '../../types';

/**
 * Drag-to-draw rectangle tool.
 *
 * The gesture is owned end-to-end by the dispatcher: the `drag` binding
 * routes to `insertAction`, which tracks the live bounds, paints the
 * preview through its `overlay()` surface, and commits via the `insert`
 * dep on release. `<SceneCanvas>` sources that dep from
 * `useInsertDepSource`; consumers wanting a custom node factory override
 * the dep (`useDepSource('insert', …)`) rather than the tool.
 *
 * Grid snapping comes from the `snap` dep, also read by `insertAction` —
 * see `SnapDep` in `interactions/actions/depSchema.ts`.
 */
export function useRectTool(): Tool<null> {
  return useMemo(
    () =>
      defineTool<null>({
        id: 'rect',
        capabilities: ['creates-shapes'],
        hookName: 'useRectTool',
        cursor: 'crosshair',
        presentation: {
          label: 'Rectangle',
          icon: createElement(RectIcon),
          group: 'shape',
        },
        // Single binding; insertAction toggles corner ⇄ center based on
        // live Alt state so users can engage/disengage Alt mid-drag and
        // see the bounds snap between the two modes.
        bindings: [
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: { params: { kind: 'rect' } },
          },
        ],
      }),
    [],
  );
}
