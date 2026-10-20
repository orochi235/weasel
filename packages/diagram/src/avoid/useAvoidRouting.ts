import { useLatest, useOptionalDepRegistry, useTransformFollower, type Scene, type TransformFollower } from '@weasel-js/core';
import { useEffect, useRef } from 'react';
import { installAvoidRouting, type AvoidRoutingOptions } from './install';

/**
 * Route `scene`'s `avoid` connectors around its shapes for the life of the
 * calling component: each edit reroutes what it disturbed in its own history
 * entry, and a drag reroutes the connectors near what it moves each frame.
 * Mount it as a child of `<SceneCanvas>`, where the drag's follower is heard,
 * after any `waypointFollower`, whose carried waypoints the drag routes through.
 * Options are read when the scene changes; `pixelSize` defaults to the
 * canvas's own view.
 */
export function useAvoidRouting<TPose>(scene: Scene<unknown, string, TPose>, opts: AvoidRoutingOptions<TPose> = {}): void {
  const deps = useOptionalDepRegistry();
  const latest = useLatest(opts);
  const follower = useRef<TransformFollower | null>(null);
  useEffect(() => {
    const pixelSize = () => latest.current.pixelSize?.() ?? 1 / Math.abs(deps?.get('view')?.get().scale.x || 1);
    const routing = installAvoidRouting(scene, { ...latest.current, pixelSize });
    follower.current = routing.follower;
    return () => {
      routing.dispose();
      follower.current = null;
    };
  }, [scene, deps, latest]);
  useTransformFollower(() => follower.current);
}
