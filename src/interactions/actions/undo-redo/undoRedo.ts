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
  /** Called after a successful undo (both keyboard- and imperatively-triggered).
   *  Use this when your adapter mutates external state in place and needs a
   *  follow-up sync step (e.g. `publish()` to refresh a React mirror of a
   *  mutable ref). Not called when the adapter has nothing to undo. */
  onUndo?: () => void;
  /** Symmetric counterpart to `onUndo`, fires after a successful redo. */
  onRedo?: () => void;
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
  const onUndoRef = useRef(options.onUndo);
  onUndoRef.current = options.onUndo;
  const onRedoRef = useRef(options.onRedo);
  onRedoRef.current = options.onRedo;

  const undo = useCallback((): boolean => {
    const a = adapterRef.current;
    if (a.canUndo && !a.canUndo()) return false;
    a.undo();
    onUndoRef.current?.();
    return true;
  }, []);

  const redo = useCallback((): boolean => {
    const a = adapterRef.current;
    if (a.canRedo && !a.canRedo()) return false;
    a.redo();
    onRedoRef.current?.();
    return true;
  }, []);

  const bind = !!options.bindKeyboard;
  useKeybinding({ key: 'z', mod: true, enabled: bind }, () => { undo(); });
  useKeybinding({ key: 'z', mod: true, shift: true, enabled: bind }, () => { redo(); });

  return { undo, redo };
}
