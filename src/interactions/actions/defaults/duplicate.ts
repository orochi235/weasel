import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/**
 * @experimental
 * Static descriptor for the `duplicate` Action. Duplicates selection.
 */
export const duplicateAction: Action = {
  id: 'duplicate',
  label: 'Duplicate',
  defaultBinding: { kind: 'key', key: 'd', mods: { mod: true } },
  invoker: {
    timing: 'immediate',
    run: (_deps, params) => {
      // The static descriptor's invoker is a no-op without the typed deps bag
      // (cloneNode, applyOps) the consumer supplies via SceneCanvas's
      // legacy bridge. Real wiring lives in useStandardActions / the
      // dep registry.
      void params;
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
