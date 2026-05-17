import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/**
 * @experimental
 * Static descriptor for the `delete` Action.
 */
export const deleteAction: Action = {
  id: 'delete',
  label: 'Delete',
  gestureBinding: { kind: 'key', key: ['Delete', 'Backspace'] },
  invoker: {
    timing: 'immediate',
    run: (_deps, params) => {
      // Static descriptor's invoker is a stub — the real wiring threads
      // through SceneCanvas's legacy bridge (which still supplies the
      // typed getNodeIndex / applyOps deps).
      void params;
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
