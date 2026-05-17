/**
 * `useLegacyActionBridges` — historically registered `delete` / `duplicate` /
 * `group` / `ungroup` via factory-style descriptors that carried a typed deps
 * bag (selection / scene / adapter). Those factories were deleted alongside
 * the legacy consumer hooks; the kit-standard descriptors at
 * `interactions/actions/defaults/<name>.ts` are now the only registered shape.
 *
 * The hook is kept (as a no-op) only so that `SceneCanvas.tsx` continues to
 * compile while the parallel registry-unification work owns that file. It
 * will be removed in a follow-up commit that touches SceneCanvas.tsx.
 */
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { Group } from 'features/groups/types';

interface BridgeAdapter {
  applyOps(ops: Op[], label?: string): void;
  getGroup?(id: string): Group | undefined;
}

export interface LegacyActionDefaults {
  cloneNode?: (id: NodeId, offset: { dx: number; dy: number }) => { id: NodeId };
  duplicateOffset?: { dx: number; dy: number };
}

export function useLegacyActionBridges(
  _selection: SelectionApi,
  _scene: Scene<unknown, string, unknown>,
  _adapter: BridgeAdapter,
  _actionDefaults: LegacyActionDefaults | undefined,
): void {
  // Intentional no-op — see file header.
}
