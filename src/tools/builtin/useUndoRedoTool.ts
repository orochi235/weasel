import { useMemo } from 'react';
import { useUndoRedo, type UndoRedoAdapter, type UseUndoRedoOptions } from 'interactions/actions/undo-redo/undoRedo';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

export interface UseUndoRedoToolOptions extends UseUndoRedoOptions {}

/** Always-on Tool wrapping `useUndoRedo`. Handles Mod+Z (undo) and
 *  Mod+Shift+Z (redo); treats `meta` and `ctrl` interchangeably for
 *  cross-platform support. The legacy hook's document keybinding is
 *  suppressed by passing `bindKeyboard: false`. */
export function useUndoRedoTool(
  adapter: UndoRedoAdapter,
  options: UseUndoRedoToolOptions = {},
): Tool<undefined> {
  const ctl = useUndoRedo(adapter, { ...options, bindKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'undoRedo',
        keyboard: {
          onDown: (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod || e.key.toLowerCase() !== 'z') return 'pass';
            if (e.shiftKey) ctl.redo();
            else ctl.undo();
            return 'claim';
          },
        },
      }),
    [ctl],
  );
}
