import { useMemo } from 'react';
import { useDelete, type DeleteAdapter, type UseDeleteOptions } from 'interactions/actions/delete/delete';
import { defineTool, claim } from '../../routing';
import type { Tool } from '../../types';

export interface UseDeleteToolOptions extends UseDeleteOptions {}

/** Always-on Tool wrapping `useDelete`. Handles Backspace and Delete via
 *  the declarative keyDown route (fired on every ambient-slot tool by
 *  the dispatcher). The legacy hook's document-level keybinding is
 *  suppressed by passing `enableKeyboard: false`. */
export function useDeleteTool(
  adapter: DeleteAdapter,
  options: UseDeleteToolOptions = {},
): Tool<undefined> {
  const ctl = useDelete(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'delete',
        initial: {
          keyDown: {
            Backspace: () => {
              ctl.deleteSelection();
              return claim();
            },
            Delete: () => {
              ctl.deleteSelection();
              return claim();
            },
          },
        },
      }),
    [ctl],
  );
}
