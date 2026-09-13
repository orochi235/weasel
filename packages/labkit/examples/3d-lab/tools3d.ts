/**
 * The lab's one shape tool.
 *
 * The camera tools moved to `@weasel-js/kernel3d` — they are engine surface.
 * This one is a demo: it declares a drag binding onto core's `insert` and
 * nothing else, which is the whole of what a shape tool is in any dimension.
 */

import { defineTool, type Tool } from '@weasel-js/core';

export function useBoxTool(): Tool<null> {
  return defineTool<null>({
    id: 'box',
    capabilities: ['creates-shapes'],
    hookName: 'useBoxTool',
    cursor: 'crosshair',
    presentation: { label: 'Box', group: 'shape' },
    bindings: [
      { spec: { kind: 'drag' }, actionId: 'insert', opts: { params: { kind: 'rect' } } },
    ],
  });
}
