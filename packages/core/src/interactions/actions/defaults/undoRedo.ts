import { createElement } from 'react';
import { RedoIcon, UndoIcon } from './icons/actionGlyphIcons';
import { ActionDisabledReason, type Action, type ActionDeps } from '@weasel-js/routing';

function historyCan(deps: ActionDeps | undefined, which: 'canUndo' | 'canRedo'): true | ActionDisabledReason {
  return deps?.history?.[which]?.() ? true : ActionDisabledReason.NotApplicable;
}

/**
 * @experimental
 * Static descriptor for the `undo` Action.
 */
// No `eligible` field → undo/redo are always eligible across all modes.
export const undoAction: Action & { requires: string[] } = {
  id: 'undo',
  label: 'Undo',
  icon: createElement(UndoIcon),
  group: 'history',
  defaultBinding: { kind: 'key', key: 'z', mods: { mod: true } },
  requires: ['history'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      deps.history?.undo?.();
    },
  },
  enabled: (deps) => historyCan(deps, 'canUndo'),
};

/**
 * @experimental
 * Static descriptor for the `redo` Action.
 */
export const redoAction: Action & { requires: string[] } = {
  id: 'redo',
  label: 'Redo',
  icon: createElement(RedoIcon),
  group: 'history',
  defaultBinding: { kind: 'key', key: 'z', mods: { mod: true, shift: true } },
  requires: ['history'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      deps.history?.redo?.();
    },
  },
  enabled: (deps) => historyCan(deps, 'canRedo'),
};
