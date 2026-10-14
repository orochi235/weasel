import { hitPredicate } from '@weasel-js/gestures';
import type { SurfaceContribution } from 'canvas/surfaceContribution';
import { symmetryAxisDragAction } from './axisDrag';
import { SYMMETRY_AFFORDANCE_KIND, symmetryAxisLayer, type SymmetryAxisLayerOptions } from './axisLayer';
import type { SymmetryStore } from './types';

const MODS_ANY = { shift: 'optional', alt: 'optional', meta: 'optional', ctrl: 'optional' } as const;

const onAxisHandle = hitPredicate((hit) => (hit as { kind?: string } | null | undefined)?.kind === SYMMETRY_AFFORDANCE_KIND);

/**
 * Live symmetry as one canvas entry, for `<SceneCanvas ambient>`: it publishes
 * `store` as the `symmetry` dep, so every tool's insert is twinned and path
 * edits on a self-symmetric path mirror, and it draws the axis with a handle
 * that drags it. Build it once (`useMemo`) per store: the entry attaches by
 * identity.
 */
export function symmetryContribution(
  store: SymmetryStore,
  layer: Omit<SymmetryAxisLayerOptions, 'get'> = {},
): SurfaceContribution {
  const axisLayer = { ...symmetryAxisLayer({ ...layer, get: store.get }), subscribe: store.subscribe };
  return {
    id: 'weasel-symmetry',
    eligibility: { claimed: true },
    deps: { symmetry: () => store },
    actions: [symmetryAxisDragAction],
    bindings: [
      { spec: { kind: 'drag', target: { kindOf: onAxisHandle }, mods: MODS_ANY }, actionId: symmetryAxisDragAction.id },
    ],
    attach: (api) => {
      const off = api.registerLayer(axisLayer);
      api.requestRedraw();
      return off;
    },
  };
}
