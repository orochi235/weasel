import { useMemo } from 'react';
import { useUndoRedo, type UndoRedoAdapter, type UseUndoRedoOptions } from 'interactions/actions/undo-redo/undoRedo';
import { defineTool, claim, none } from '../../routing';
import type { Tool } from '../../types';

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
        initial: {
          keyDown: {
            z: (_ctx, event) => {
              const e = event as KeyboardEvent;
              if (!(e.metaKey || e.ctrlKey)) return none();
              if (e.shiftKey) ctl.redo();
              else ctl.undo();
              return claim();
            },
            Z: (_ctx, event) => {
              const e = event as KeyboardEvent;
              if (!(e.metaKey || e.ctrlKey)) return none();
              // Shift is implicit (the key is uppercase Z), but check
              // anyway so a stray IME event with Z and no Shift doesn't
              // misfire redo.
              if (!e.shiftKey) return none();
              ctl.redo();
              return claim();
            },
          },
        },
      }),
    [ctl],
  );
}
