import type { Action } from '../registry';

/**
 * @experimental
 * Static descriptor for the `undo` Action.
 */
// No `eligible` field → undo/redo are always eligible across all modes.
export const undoAction: Action & { requires: string[] } = {
  id: 'undo',
  label: 'Undo',
  defaultBinding: { kind: 'key', key: 'z', mods: { mod: true } },
  requires: ['history'],
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
export const redoAction: Action & { requires: string[] } = {
  id: 'redo',
  label: 'Redo',
  defaultBinding: { kind: 'key', key: 'z', mods: { mod: true, shift: true } },
  requires: ['history'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      (deps.history as { redo?: () => boolean } | undefined)?.redo?.();
    },
  },
};
