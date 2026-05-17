import type { Action } from '../registry';

/** @experimental */
export interface UndoRedoDeps {
  undo: () => boolean;
  redo: () => boolean;
  canUndo?: () => boolean;
  canRedo?: () => boolean;
}

/**
 * @experimental
 * Static descriptor for the `undo` Action.
 */
export const undoAction: Action = {
  id: 'undo',
  label: 'Undo',
  gestureBinding: { kind: 'key', key: 'z', mods: { mod: true } },
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      (deps.history as { undo?: () => boolean } | undefined)?.undo?.();
    },
  },
};

/**
 * @experimental
 * Static descriptor for the `redo` Action.
 */
export const redoAction: Action = {
  id: 'redo',
  label: 'Redo',
  gestureBinding: { kind: 'key', key: 'z', mods: { mod: true, shift: true } },
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      (deps.history as { redo?: () => boolean } | undefined)?.redo?.();
    },
  },
};

/**
 * @experimental
 * Factory for the two default undo/redo Actions: `undo` (⌘+Z) and
 * `redo` (⇪+⌘+Z). Hidden when `canUndo` / `canRedo` are supplied and
 * report no available step.
 *
 * @deprecated Phase 4+: use `undoAction`/`redoAction` directly. This wrapper
 * is a Phase 4–7 transition shim and will be removed in Phase 8.
 */
export function defaultUndoRedoActions(deps: UndoRedoDeps): Action[] {
  // Exclude `invoker` so the legacy run path stays active until Task 8.
  const { invoker: _undoInvoker, ...undoFields } = undoAction;
  const { invoker: _redoInvoker, ...redoFields } = redoAction;
  void _undoInvoker;
  void _redoInvoker;
  return [
    {
      ...undoFields,
      run: () => { deps.undo(); },
      ...(deps.canUndo
        ? { enabled: () => (deps.canUndo!() ? true : 'not-applicable' as const) }
        : {}),
    },
    {
      ...redoFields,
      run: () => { deps.redo(); },
      ...(deps.canRedo
        ? { enabled: () => (deps.canRedo!() ? true : 'not-applicable' as const) }
        : {}),
    },
  ];
}
