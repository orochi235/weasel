import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';

/** Publish the pose descriptor every built-in action reads. */
export function usePoseDescriptorDepSource(
  descriptor: PoseDescriptor<unknown> | undefined,
): void {
  const ref = useLatest(descriptor);
  useDepSource('poseDescriptor', () => ref.current ?? AUTO_POSE_DESCRIPTOR);
}
