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
 * Factory for the two default undo/redo Actions: `undo` (⌘+Z) and
 * `redo` (⇪+⌘+Z). Hidden when `canUndo` / `canRedo` are supplied and
 * report no available step.
 */
export function defaultUndoRedoActions(deps: UndoRedoDeps): Action[] {
  return [
    {
      id: 'undo',
      label: 'Undo',
      defaultBinding: { key: 'z', mod: true },
      gestureBinding: { kind: 'key', key: 'z', mods: { mod: true } },
      run: () => { deps.undo(); },
      ...(deps.canUndo
        ? { enabled: () => (deps.canUndo!() ? true : 'not-applicable' as const) }
        : {}),
    },
    {
      id: 'redo',
      label: 'Redo',
      defaultBinding: { key: 'z', mod: true, shift: true },
      gestureBinding: { kind: 'key', key: 'z', mods: { mod: true, shift: true } },
      run: () => { deps.redo(); },
      ...(deps.canRedo
        ? { enabled: () => (deps.canRedo!() ? true : 'not-applicable' as const) }
        : {}),
    },
  ];
}
