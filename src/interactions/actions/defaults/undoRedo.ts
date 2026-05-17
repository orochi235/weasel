import type { Action } from '../registry';

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
