import { ActionDisabledReason, type Action, type ActionDeps } from '@weasel-js/routing';
import { icon } from '../../../icons.gen';

function historyCan(deps: ActionDeps | undefined, which: 'canUndo' | 'canRedo'): true | ActionDisabledReason {
  return deps?.history?.[which]?.() ? true : ActionDisabledReason.NotApplicable;
}

/**
 * Static descriptor for the `undo` Action.
 */
// No `eligible` field → undo/redo are always eligible across all modes.
export const undoAction: Action & { requires: string[] } = {
  id: 'undo',
  label: 'Undo',
  icon: icon('undo'),
  group: 'history',
  defaultBinding: [{ spec: { kind: 'key', key: 'z', mods: { mod: true } }, opts: { id: 'undo.key' } }],
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
 * Static descriptor for the `redo` Action.
 */
export const redoAction: Action & { requires: string[] } = {
  id: 'redo',
  label: 'Redo',
  icon: icon('redo'),
  group: 'history',
  defaultBinding: [{ spec: { kind: 'key', key: 'z', mods: { mod: true, shift: true } }, opts: { id: 'redo.key' } }],
  requires: ['history'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      deps.history?.redo?.();
    },
  },
  enabled: (deps) => historyCan(deps, 'canRedo'),
};
