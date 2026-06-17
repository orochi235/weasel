import { useMemo } from 'react';
import { defineTool } from '@weasel-js/core/routing';

/** WeaselDraw "Slice" tool: drag a straight line; crossed paths split (Knife). */
export function useSliceTool() {
  return useMemo(
    () =>
      defineTool<null>({
        id: 'slice',
        capabilities: ['edits-page'],
        cursor: 'crosshair',
        presentation: {
          label: 'Slice',
          group: 'shape',
          // No knife icon asset exists yet; icon omitted.
        },
        bindings: [{ spec: { kind: 'drag' }, actionId: 'slice' }],
        initial: {},
      }),
    [],
  );
}
