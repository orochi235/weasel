import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/**
 * @experimental
 * Static descriptor for the `group` Action.
 */
export const groupAction: Action = {
  id: 'group',
  label: 'Group',
  defaultBinding: { kind: 'key', key: 'g', mods: { mod: true } },
  invoker: {
    timing: 'immediate',
    run: (_deps, params) => {
      // Stub — depSchema wiring lives in useStandardActions.
      void params;
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};

/**
 * @experimental
 * Static descriptor for the `ungroup` Action.
 */
export const ungroupAction: Action = {
  id: 'ungroup',
  label: 'Ungroup',
  defaultBinding: { kind: 'key', key: 'g', mods: { mod: true, shift: true } },
  invoker: {
    timing: 'immediate',
    run: (_deps, params) => {
      // Stub — depSchema wiring lives in useStandardActions.
      void params;
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
