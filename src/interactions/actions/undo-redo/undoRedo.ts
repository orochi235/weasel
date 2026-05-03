import { useCallback, useRef } from 'react';
import { useKeybinding } from '../useKeybinding';

/** Adapter for `useUndoRedo`. Shape is the subset of `History` the hook
 *  actually needs, so consumers can wire any equivalent stack — or wrap a
 *  redux-style store — without conforming to the full `History` interface. */
export interface UndoRedoAdapter {
  undo(): void;
  redo(): void;
  canUndo?(): boolean;
  canRedo?(): boolean;
}

/** Options for `useUndoRedo`. */
export interface UseUndoRedoOptions {
  /** Auto-bind Mod+Z (undo) and Mod+Shift+Z (redo) on document. Default false. */
  bindKeyboard?: boolean;
}

/** Return shape of `useUndoRedo`. */
export interface UseUndoRedoReturn {
  /** Imperative trigger — undo if the adapter has anything to undo. Returns
   *  `true` if a step was popped, `false` otherwise. */
  undo(): boolean;
  /** Imperative trigger — redo if the adapter has anything to redo. */
  redo(): boolean;
}

/** Undo/redo action; optionally binds Mod+Z and Mod+Shift+Z. */
export function useUndoRedo(
  adapter: UndoRedoAdapter,
  options: UseUndoRedoOptions = {},
): UseUndoRedoReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const undo = useCallback((): boolean => {
    const a = adapterRef.current;
    if (a.canUndo && !a.canUndo()) return false;
    a.undo();
    return true;
  }, []);

  const redo = useCallback((): boolean => {
    const a = adapterRef.current;
    if (a.canRedo && !a.canRedo()) return false;
    a.redo();
    return true;
  }, []);

  const bind = !!options.bindKeyboard;
  useKeybinding({ key: 'z', mod: true, enabled: bind }, () => { undo(); });
  useKeybinding({ key: 'z', mod: true, shift: true, enabled: bind }, () => { redo(); });

  return { undo, redo };
}
