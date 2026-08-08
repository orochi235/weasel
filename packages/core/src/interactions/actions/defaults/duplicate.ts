import type { Action } from '../registry';
import { requiresSelection } from './requiresSelection';

/**
 * @experimental
 * Static descriptor for the `duplicate` Action. Duplicates selection.
 */
export const duplicateAction: Action & { requires: string[] } = {
  id: 'duplicate',
  label: 'Duplicate',
  defaultBinding: { kind: 'key', key: 'd', mods: { mod: true } },
  eligible: { capability: ['edits-page', 'creates-selection'] },
  // Read by the `enabled` gate below, not by this invoker. Undeclared, the
  // dev-build deps Proxy throws before the gate can answer — so Cmd+D did
  // nothing at all.
  requires: ['selection'],
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
  enabled: requiresSelection,
};
