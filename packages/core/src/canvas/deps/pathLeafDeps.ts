import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { useBooleansAdapterSource } from './booleans';
import { useSliceDepSource, type OpsApplier } from './slice';

/** The kit deps that rewrite a scene's path leaves: `slice` and `booleansAdapter`. */
export function usePathLeafDepSources(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  adapter: OpsApplier,
  poseDescriptor?: PoseDescriptor<unknown>,
): void {
  useSliceDepSource(scene, selection, adapter, poseDescriptor);
  useBooleansAdapterSource(scene, selection, adapter, poseDescriptor);
}
