import { useCallback, useRef } from 'react';
import { unionAABB } from 'core/geometry/unionBounds';
import type { Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { sceneContentBounds } from '../contentBounds';
import type { GestureSource } from '../gestureBounds';
import { gestureBoundsOf, useInFlightBounds } from '../useInFlightBounds';
import { worldPoseOf, type ViewPoseAdapter } from '../useViewHelpers';

/**
 * The world rect a scene's content covers: every root it draws, boxed as the
 * picker boxes it, every copy a group draws (`sceneContentBounds`), and
 * whatever an in-flight gesture proposes, such as a node being dragged, where
 * it is shown, or a shape drawn before it exists. `null`
 * when nothing is drawn. Read live: the scene's part is kept until its version
 * or its bounds source moves, and the gesture's part is read fresh.
 */
export function useContentBounds<TPose>(args: {
  scene: Scene<unknown, string, TPose>;
  /** A node's world box as committed. */
  boundsOf: (id: string) => Bounds | null;
  /** A node's world box at `pose`. */
  boundsOfPose: (id: string, pose: TPose) => Bounds | null;
  adapter: ViewPoseAdapter<TPose>;
  gestureSource: GestureSource | undefined;
  previewPoseExtra: ((id: string) => unknown) | undefined;
}): () => Bounds | null {
  const { scene, boundsOf, adapter, gestureSource } = args;
  const committedPoseOf = useCallback((id: string): TPose | null => {
    try {
      return worldPoseOf(adapter, id);
    } catch {
      return null;
    }
  }, [adapter]);
  const worldOfStored = adapter.worldOfStored
    ? (id: string, stored: TPose) => adapter.worldOfStored!(id, stored)
    : undefined;
  const { previewBoundsOf } = useInFlightBounds({
    gestureSource, previewPoseExtra: args.previewPoseExtra, boxOf: args.boundsOfPose, committedPoseOf, worldOfStored,
  });

  const committed = useRef<{ scene: unknown; boundsOf: unknown; version: number; bounds: Bounds | null } | null>(null);
  return useCallback((): Bounds | null => {
    const version = scene.getVersion();
    let held = committed.current;
    if (held === null || held.scene !== scene || held.boundsOf !== boundsOf || held.version !== version) {
      const bounds = sceneContentBounds(scene, boundsOf, (node) => committedPoseOf(node.id) ?? node.pose);
      held = { scene, boundsOf, version, bounds };
      committed.current = held;
    }
    return unionAABB([held.bounds, gestureBoundsOf(gestureSource, previewBoundsOf)]);
  }, [scene, boundsOf, committedPoseOf, gestureSource, previewBoundsOf]);
}
