import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Scene } from 'core/scene/types';
import type { OperandsDep } from 'interactions/actions/operands';
import { useBooleansAdapterSource } from './booleans';
import { useSliceDepSource, type OpsApplier } from './slice';

/** The kit deps that rewrite a scene's path leaves, `slice` and `booleansAdapter`, acting on `operands`. */
export function usePathLeafDepSources(
  scene: Scene<unknown, string, unknown>,
  operands: OperandsDep,
  adapter: OpsApplier,
  poseDescriptor?: PoseDescriptor<unknown>,
): void {
  useSliceDepSource(scene, operands, adapter, poseDescriptor);
  useBooleansAdapterSource(scene, operands, adapter, poseDescriptor);
}
