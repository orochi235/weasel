import { useLatest, useTransformFollower, type Scene, type TransformFollower } from '@weasel-js/core';
import { useEffect, useRef } from 'react';
import { installHops, type HopsOptions } from './install';

/**
 * Hop `scene`'s crossing connectors for the life of the calling component,
 * while its line-jump setting is on: each edit recomputes the hops it
 * disturbed in its own history entry, and a drag hides the hops on what it
 * moves. Mount it as a child of `<SceneCanvas>`, after any routing hook, so its
 * follower hears the routes that one previews. Options are read when the scene
 * changes.
 */
export function useHops<TPose>(scene: Scene<unknown, string, TPose>, opts: HopsOptions<TPose> = {}): void {
  const latest = useLatest(opts);
  const follower = useRef<TransformFollower | null>(null);
  useEffect(() => {
    const hops = installHops(scene, latest.current);
    follower.current = hops.follower;
    return () => {
      hops.dispose();
      follower.current = null;
    };
  }, [scene, latest]);
  useTransformFollower(() => follower.current);
}
