import { createElement } from 'react';
import { RedoIcon, UndoIcon } from './icons/actionGlyphIcons';
import { ActionDisabledReason, type Action, type ActionDeps } from '@weasel-js/routing';

type HistoryReads = { canUndo?: () => boolean; canRedo?: () => boolean };

function historyCan(deps: ActionDeps | undefined, which: 'canUndo' | 'canRedo'): true | ActionDisabledReason {
  const history = deps?.history as HistoryReads | undefined;
  return history?.[which]?.() ? true : ActionDisabledReason.NotApplicable;
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
      (deps.history as { undo?: () => boolean } | undefined)?.undo?.();
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
      (deps.history as { redo?: () => boolean } | undefined)?.redo?.();
    },
  },
  enabled: (deps) => historyCan(deps, 'canRedo'),
};
