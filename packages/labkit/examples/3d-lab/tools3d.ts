/**
 * The lab's one shape tool.
 *
 * The camera tools moved to `@weasel-js/kernel3d` — they are engine surface.
 * This one is a demo: it declares a drag binding onto core's `insert` and
 * nothing else, which is the whole of what a shape tool is in any dimension.
 */

import { useMemo } from 'react';
import { defineTool, type Tool } from '@weasel-js/routing';
import { icon } from '../../src/icons.gen';

export function useBoxTool(): Tool {
  return useMemo(() => defineTool({
    id: 'box',
    capabilities: ['creates-shapes'],
    hookName: 'useBoxTool',
    cursor: 'crosshair',
    presentation: { label: 'Box', icon: icon('ui:cube'), group: 'shape' },
    bindings: [
      { spec: { kind: 'drag' }, actionId: 'insert', opts: { id: 'box.drag', params: { kind: 'rect' } } },
    ],
  }), []);
}
