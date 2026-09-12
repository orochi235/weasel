import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { PoseComposition } from 'features/groups/composePose';

/** Publish the scene's pose-composition strategy to the built-in actions.
 *  Absent is the absolute-pose model: `scenePoseFrame` falls back to identity
 *  and every world/local conversion in an action is a no-op. */
export function usePoseCompositionDepSource(
  composition: PoseComposition<unknown> | undefined,
): void {
  const ref = useRef(composition);
  ref.current = composition;
  useDepSource('poseComposition', () => ref.current);
}
