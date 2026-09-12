import type { PoseDescriptor } from './resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from './resize/autoPoseDescriptor';

/** The `poseDescriptor` dep's value, or the auto descriptor when unsourced. */
export function poseDescriptorOf(dep: unknown): PoseDescriptor<unknown> {
  return (dep as PoseDescriptor<unknown> | undefined) ?? AUTO_POSE_DESCRIPTOR;
}
