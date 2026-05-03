import { useMemo } from 'react';
import { useDelete, type DeleteAdapter, type UseDeleteOptions } from '../../interactions/actions/delete/delete';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

export interface UseDeleteToolOptions extends UseDeleteOptions {}

/** Always-on Tool wrapping `useDelete`. Declares its own keybinding
 *  (`Backspace`); also handles `Delete` inside the handler since `Tool.keybinding`
 *  is single-valued. The legacy hook's document-level keybinding is suppressed
 *  by passing `bindKeyboard: false` — the dispatcher fires this tool instead. */
export function useDeleteTool(
  adapter: DeleteAdapter,
  options: UseDeleteToolOptions = {},
): Tool<undefined> {
  // bindKeyboard: false — the Tool owns its keybinding via the dispatcher.
  const ctl = useDelete(adapter, { ...options, bindKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'delete',
        keybinding: 'Backspace',
        keyboard: {
          onDown: (e) => {
            if (e.key !== 'Backspace' && e.key !== 'Delete') return 'pass';
            ctl.deleteSelection();
            return 'claim';
          },
        },
      }),
    [ctl],
  );
}
