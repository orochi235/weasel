import { useMemo } from 'react';
import { defineTool } from '@weasel-js/core';

/**
 * WeaselDraw "Slice" tool: drag a straight line, or Alt-drag a freehand cut;
 * crossed closed paths split (Knife) and crossed open paths are snipped along
 * their stroke (Scissors).
 */
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
        keybinding: { key: 'K' },
        bindings: [
          { spec: { kind: 'drag' }, actionId: 'slice' },
          { spec: { kind: 'drag', mods: { alt: true } }, actionId: 'slice', opts: { params: { cut: 'freehand' } } },
        ],
      }),
    [],
  );
}
